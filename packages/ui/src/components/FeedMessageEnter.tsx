import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
  type ReactNode,
} from 'react';
import Box from '@mui/material/Box';

const MESSAGE_ENTER = 'feedMessageEnter';
const MESSAGE_ENTER_MS = 360;
const MESSAGE_STAGGER_MS = 90;
const MAX_STAGGER_INDEX = 4;

export { MESSAGE_ENTER_MS, MESSAGE_STAGGER_MS };

export type FeedMessageEnterProps = {
  messageId: string;
  animateEntry: boolean;
  staggerIndex: number;
  onAnimationDone: (messageId: string) => void;
  children: ReactNode;
};

/** Fade entry wrapper for feed thread cards. Opacity-only to avoid transform text reflow. */
export function FeedMessageEnter({
  messageId,
  animateEntry,
  staggerIndex,
  onAnimationDone,
  children,
}: FeedMessageEnterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldAnimate] = useState(animateEntry);
  const [willAnimate, setWillAnimate] = useState(animateEntry);
  const [staggerDelay] = useState(
    Math.min(staggerIndex, MAX_STAGGER_INDEX) * MESSAGE_STAGGER_MS,
  );
  const [isVisible, setIsVisible] = useState(!animateEntry);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!shouldAnimate) {
      return;
    }
    const el = ref.current;
    if (!el) {
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        } else {
          setWillAnimate(false);
          setIsVisible(true);
          doneRef.current = true;
          onAnimationDone(messageId);
        }
        observer.disconnect();
      },
      { threshold: 0.01 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [messageId, onAnimationDone, shouldAnimate]);

  useEffect(() => {
    if (!willAnimate || !isVisible || doneRef.current) {
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      doneRef.current = true;
      onAnimationDone(messageId);
    }
  }, [isVisible, messageId, onAnimationDone, willAnimate]);

  const handleAnimationEnd = useCallback(
    (event: AnimationEvent<HTMLDivElement>) => {
      if (event.animationName !== MESSAGE_ENTER || doneRef.current) {
        return;
      }
      doneRef.current = true;
      onAnimationDone(messageId);
    },
    [messageId, onAnimationDone],
  );

  const isAnimating = willAnimate && isVisible;

  return (
    <Box
      ref={ref}
      onAnimationEnd={handleAnimationEnd}
      sx={{
        width: '100%',
        [`@keyframes ${MESSAGE_ENTER}`]: {
          from: {
            opacity: 0,
          },
          to: {
            opacity: 1,
          },
        },
        opacity: willAnimate && !isVisible ? 0 : undefined,
        animation: isAnimating
          ? `${MESSAGE_ENTER} ${MESSAGE_ENTER_MS}ms ease-out ${staggerDelay}ms both`
          : 'none',
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
          opacity: 1,
        },
      }}
    >
      {children}
    </Box>
  );
}
