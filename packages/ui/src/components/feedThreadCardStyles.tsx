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

  return {
    position: 'relative',
    borderRadius: 1.5,
    isolation: 'isolate',
    boxShadow: theme.shadows[2],
    backgroundColor: isLight ? theme.feedLab.encBg : '#1c1917',
    backgroundImage: isLight
      ? 'none'
      : [
          `linear-gradient(to right, ${alpha('#000000', 0.14)} 0%, transparent 28%)`,
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
    backgroundColor: isLight ? alpha('#ffffff', 0.44) : alpha('#ffffff', 0.08),
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
      ? null
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
    border: isLight ? `1px solid ${theme.palette.divider}` : null,
    boxShadow: isLight ? null : 'inset 0 1px 0 rgba(255,255,255,0.06)',
    backgroundColor: isLight ? alpha('#ffffff', 0.48) : alpha('#ffffff', 0.06),
    backgroundImage: 'none',
    px: 1.25,
    py: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };
};

/** Thread avatar styling (sender / comment author initials). */
export const threadAvatarGlassSx = (size: number) => (theme: Theme) => ({
  width: size,
  height: size,
  flexShrink: 0,
  fontSize: size >= 32 ? '0.75rem' : '0.6875rem',
  fontWeight: 700,
  borderRadius: '50%',
  color: 'text.primary',
  border: 'none',
  backgroundColor: alpha(theme.feedLab.accentBg, 0.5),
  boxShadow: `inset 1px 1px 3px 0 ${theme.feedLab.insetShadow}`,
  backgroundImage: 'none',
});

export type ThreadGlassAvatarProps = {
  size: number;
  children: ReactNode;
};

/** Avatar for thread sender / comment author initials. */
export function ThreadGlassAvatar({ size, children }: ThreadGlassAvatarProps) {
  return <Avatar sx={threadAvatarGlassSx(size)}>{children}</Avatar>;
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
