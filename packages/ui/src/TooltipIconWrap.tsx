import Box from '@mui/material/Box';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

type TooltipIconWrapProps = ComponentPropsWithoutRef<'span'> & {
  children: ReactNode;
};

const ICON_SLOT_PX = 30;

/** Stable inline wrapper so MUI Tooltip can attach listeners without shifting layout. */
export const TooltipIconWrap = forwardRef<HTMLSpanElement, TooltipIconWrapProps>(
  function TooltipIconWrap({ children, style, ...props }, ref) {
    return (
      <Box
        component="span"
        ref={ref}
        {...props}
        style={style}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: ICON_SLOT_PX,
          height: ICON_SLOT_PX,
          flexShrink: 0,
        }}
      >
        {children}
      </Box>
    );
  },
);
