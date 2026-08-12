import type { ReactNode } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { alpha, type Theme } from '@mui/material/styles';

export const threadCardPaperSx = (highlighted: boolean) => (theme: Theme) => ({
  overflow: 'hidden',
  backgroundColor: 'transparent',
  backgroundImage: 'none',
  boxShadow: 'none',
  transition: theme.transitions.create('border-color', {
    duration: 1000,
  }),
  borderColor: highlighted ? 'primary.main' : theme.palette.divider,
});

export type ThreadCardSurfaceProps = {
  highlighted: boolean;
  children: ReactNode;
};

/** Outer thread card shell with optional border highlight. */
export function ThreadCardSurface({
  highlighted,
  children,
}: ThreadCardSurfaceProps) {
  return (
    <Paper elevation={0} sx={threadCardPaperSx(highlighted)}>
      {children}
    </Paper>
  );
}

/** Layered gradient field behind the glass panel — blur reads against this, not flat card paper. */
export const messageGlassBackdropSx = (theme: Theme) => {
  const isLight = theme.palette.mode === 'light';
  const brand = theme.feedLab.brand;

  return {
    position: 'relative',
    borderRadius: 1.5,
    overflow: 'hidden',
    isolation: 'isolate',
    backgroundColor: isLight ? theme.feedLab.encBg : '#1c1917',
    backgroundImage: isLight
      ? [
          `linear-gradient(to right, ${alpha(theme.palette.text.primary, 0.08)} 0%, transparent 26%)`,
          `radial-gradient(ellipse 40px 30px at 12px 14px, ${alpha(brand, 0.22)}, transparent 22px)`,
          `radial-gradient(ellipse 56px 40px at calc(100% - 12px) calc(100% - 10px), ${alpha('#78716c', 0.07)}, transparent 52px)`,
          `linear-gradient(138deg, ${alpha('#ffffff', 0.98)} 0%, ${theme.feedLab.encBg} 48%, ${alpha('#e7e5e4', 0.78)} 100%)`,
        ].join(', ')
      : [
          `linear-gradient(to right, ${alpha('#000000', 0.14)} 0%, transparent 28%)`,
          `radial-gradient(ellipse 40px 30px at 12px 14px, ${alpha(brand, 0.16)}, transparent 22px)`,
          `radial-gradient(ellipse 56px 40px at calc(100% - 12px) calc(100% - 10px), ${alpha('#a8a29e', 0.06)}, transparent 52px)`,
          `linear-gradient(138deg, #2c2926 0%, #1c1917 52%, #292524 100%)`,
        ].join(', '),
  };
};

/** Frosted glass panel for the main message body (decrypt + plaintext). */
export const messageGlassPaperSx = (theme: Theme) => {
  const isLight = theme.palette.mode === 'light';

  return {
    position: 'relative',
    zIndex: 1,
    borderRadius: 1.5,
    border: 'none',
    boxShadow: isLight
      ? '0 2px 18px rgba(28,25,23,0.08), inset 0 1px 0 rgba(255,255,255,0.75)'
      : '0 4px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)',
    backgroundColor: isLight ? alpha('#ffffff', 0.44) : alpha('#ffffff', 0.08),
    backdropFilter: isLight
      ? 'blur(20px) saturate(1.28)'
      : 'blur(16px) saturate(1.15)',
    WebkitBackdropFilter: isLight
      ? 'blur(20px) saturate(1.28)'
      : 'blur(16px) saturate(1.15)',
    backgroundImage: 'none',
    px: 1.625,
    py: 1.375,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };
};

/** Simple diagonal wash for comment glass — no accent blobs. */
export const commentGlassBackdropSx = (theme: Theme) => {
  const isLight = theme.palette.mode === 'light';

  return {
    position: 'relative',
    borderRadius: 1,
    overflow: 'hidden',
    isolation: 'isolate',
    backgroundColor: isLight ? theme.feedLab.encBg : '#1c1917',
    backgroundImage: isLight
      ? [
          `linear-gradient(to right, ${alpha(theme.palette.text.primary, 0.06)} 0%, transparent 22%)`,
          `linear-gradient(138deg, ${alpha('#ffffff', 0.98)} 0%, ${theme.feedLab.encBg} 48%, ${alpha('#e7e5e4', 0.78)} 100%)`,
        ].join(', ')
      : [
          `linear-gradient(to right, ${alpha('#000000', 0.11)} 0%, transparent 24%)`,
          `linear-gradient(138deg, #2c2926 0%, #1c1917 52%, #292524 100%)`,
        ].join(', '),
  };
};

/** Lighter frosted panel for comment rows. */
export const commentGlassPaperSx = (theme: Theme) => {
  const isLight = theme.palette.mode === 'light';

  return {
    position: 'relative',
    zIndex: 1,
    borderRadius: 1,
    border: 'none',
    boxShadow: isLight
      ? 'inset 0 1px 0 rgba(255,255,255,0.55)'
      : 'inset 0 1px 0 rgba(255,255,255,0.06)',
    backgroundColor: isLight ? alpha('#ffffff', 0.48) : alpha('#ffffff', 0.06),
    backdropFilter: isLight
      ? 'blur(12px) saturate(1.1)'
      : 'blur(12px) saturate(1.1)',
    WebkitBackdropFilter: isLight
      ? 'blur(12px) saturate(1.1)'
      : 'blur(12px) saturate(1.1)',
    backgroundImage: 'none',
    px: 1.25,
    py: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };
};

/** Circular gradient field behind thread avatars. */
export const threadAvatarGlassBackdropSx = (size: number) => (theme: Theme) => {
  const isLight = theme.palette.mode === 'light';

  return {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    overflow: 'hidden',
    isolation: 'isolate',
    boxShadow: isLight
      ? 'inset 0 2px 5px rgba(28,25,23,0.14), inset 0 1px 2px rgba(28,25,23,0.1)'
      : 'inset 0 2px 6px rgba(0,0,0,0.42), inset 0 1px 2px rgba(0,0,0,0.3)',
    backgroundColor: isLight ? theme.feedLab.accentBg : '#292524',
    backgroundImage: isLight
      ? [
          `radial-gradient(circle 14px at 24% 22%, ${alpha('#ffffff', 0.95)}, transparent 16px)`,
          `radial-gradient(circle 14px at 76% 78%, ${alpha('#78716c', 0.14)}, transparent 16px)`,
          `linear-gradient(138deg, ${alpha('#ffffff', 0.98)} 0%, ${theme.feedLab.accentBg} 42%, ${alpha('#d6d3d1', 0.72)} 100%)`,
        ].join(', ')
      : [
          `radial-gradient(circle 14px at 24% 22%, ${alpha('#ffffff', 0.12)}, transparent 16px)`,
          `radial-gradient(circle 14px at 76% 78%, ${alpha('#000000', 0.2)}, transparent 16px)`,
          `linear-gradient(138deg, #3a3836 0%, #292524 48%, #1c1917 100%)`,
        ].join(', '),
  };
};

/** Frosted glass styling for thread avatars (letter / "You"). */
export const threadAvatarGlassSx =
  (size: number, isOwn: boolean) => (theme: Theme) => {
    const isLight = theme.palette.mode === 'light';

    return {
      width: size,
      height: size,
      fontSize: size >= 32 ? '0.75rem' : '0.6875rem',
      fontWeight: 700,
      borderRadius: '50%',
      color: 'text.primary',
      filter: isOwn ? 'none' : 'grayscale(20%)',
      border: 'none',
      boxShadow: isLight
        ? `inset 0 2px 4px ${alpha(theme.palette.text.primary, 0.12)}, inset 0 -1px 1px ${alpha('#ffffff', 0.65)}`
        : 'inset 0 2px 4px rgba(0,0,0,0.32), inset 0 -1px 1px rgba(255,255,255,0.1)',
      backgroundColor: isLight
        ? alpha('#ffffff', 0.34)
        : alpha('#ffffff', 0.06),
      backdropFilter: 'blur(12px) saturate(1.22)',
      WebkitBackdropFilter: 'blur(12px) saturate(1.22)',
      backgroundImage: isLight
        ? `linear-gradient(145deg, ${alpha('#ffffff', 0.42)} 0%, ${alpha('#ffffff', 0.18)} 100%)`
        : `linear-gradient(145deg, ${alpha('#ffffff', 0.1)} 0%, ${alpha('#ffffff', 0.03)} 100%)`,
    };
  };

export type ThreadGlassAvatarProps = {
  size: number;
  isOwn: boolean;
  children: ReactNode;
};

/** Glass avatar for thread sender / comment author initials. */
export function ThreadGlassAvatar({
  size,
  isOwn,
  children,
}: ThreadGlassAvatarProps) {
  return (
    <Box sx={threadAvatarGlassBackdropSx(size)}>
      <Avatar sx={threadAvatarGlassSx(size, isOwn)}>{children}</Avatar>
    </Box>
  );
}

export type CommentGlassSurfaceProps = {
  children: ReactNode;
};

/** Subtle glass panel for comment rows — simpler than message glass. */
export function CommentGlassSurface({ children }: CommentGlassSurfaceProps) {
  return (
    <Box sx={commentGlassBackdropSx}>
      <Paper elevation={0} sx={commentGlassPaperSx}>
        {children}
      </Paper>
    </Box>
  );
}

export type MessageGlassSurfaceProps = {
  children: ReactNode;
};

/** Gradient backdrop + frosted glass panel for encrypted message bodies. */
export function MessageGlassSurface({ children }: MessageGlassSurfaceProps) {
  return (
    <Box sx={messageGlassBackdropSx}>
      <Paper elevation={0} sx={messageGlassPaperSx}>
        {children}
      </Paper>
    </Box>
  );
}
