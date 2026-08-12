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
  const [shouldAnimate] = useState(animateEntry);
  const [staggerDelay] = useState(staggerIndex * MESSAGE_STAGGER_MS);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!shouldAnimate || doneRef.current) {
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      doneRef.current = true;
      onAnimationDone(messageId);
    }
  }, [messageId, onAnimationDone, shouldAnimate]);

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

  return (
    <Box
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
        animation: shouldAnimate
          ? `${MESSAGE_ENTER} ${MESSAGE_ENTER_MS}ms ease-out ${staggerDelay}ms both`
          : 'none',
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
        },
      }}
    >
      {children}
    </Box>
  );
}
