import React, { useCallback } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { Theme } from '@mui/material/styles';
import { CopiedToClipboardSnackbar } from '@/components/CopiedToClipboardSnackbar.tsx';
import { useCopiedToClipboardSnackbar } from '@/hooks/useCopiedToClipboardSnackbar.tsx';

const monospaceFieldSx = {
  fontFamily: 'monospace',
  '& textarea': { fontSize: '0.75rem' },
} as const;

export type StepOutputTextFieldPaletteColor = keyof Theme['palette'];

function coloredFieldSx(color: StepOutputTextFieldPaletteColor) {
  return {
    ...monospaceFieldSx,
    '& .MuiOutlinedInput-root': {
      '& fieldset': {
        borderColor: `${color}.main`,
        borderWidth: 2,
      },
      '&:hover fieldset': {
        borderColor: `${color}.dark`,
      },
      '&.Mui-focused fieldset': {
        borderColor: `${color}.main`,
      },
    },
    '& .MuiInputLabel-root': {
      color: `${color}.main`,
    },
  };
}

export type StepOutputTextFieldProps = Omit<
  React.ComponentProps<typeof TextField>,
  'color'
> & {
  color?: StepOutputTextFieldPaletteColor;
  tooltipMessage?: string;
};

function formatTooltipTitle(message: string): React.ReactNode {
  const lines = message.split(/(?:\n|<br\s*\/?>)/gi);
  if (lines.length <= 1) {
    return message;
  }
  return lines.map((line, index) => (
    <React.Fragment key={index}>
      {index > 0 && <br />}
      {line}
    </React.Fragment>
  ));
}

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.every((v) => v === '');
  return false;
}

function valueToCopyText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join('');
  return String(value);
}

function labelWithTopBarPlaceholder(
  label: React.ReactNode,
  placeholder: string,
): React.ReactNode {
  return (
    <Box component="span" sx={{ display: 'inline' }}>
      {label}
      <Typography
        component="span"
        variant="inherit"
        color="text.secondary"
        sx={{ fontWeight: 400 }}
      >
        {' · '}
        {placeholder}
      </Typography>
    </Box>
  );
}

export function StepOutputTextField({
  color,
  tooltipMessage,
  sx,
  placeholder,
  label,
  value,
  slotProps,
  onClick,
  ...props
}: StepOutputTextFieldProps) {
  const { copyAndNotify, snackbarProps } = useCopiedToClipboardSnackbar();

  const handleClick = useCallback(
    async (event: React.MouseEvent<HTMLDivElement>) => {
      if (onClick) {
        onClick(event);
        return;
      }

      const text = valueToCopyText(value);
      if (text.length === 0) return;

      await copyAndNotify(text);
    },
    [copyAndNotify, onClick, value],
  );

  const showPlaceholderInLabel =
    placeholder != null && placeholder !== '' && isEmptyValue(value);

  const resolvedLabel =
    showPlaceholderInLabel && label != null
      ? labelWithTopBarPlaceholder(label, placeholder)
      : label;

  const field = (
    <TextField
      {...props}
      label={resolvedLabel}
      value={value}
      onClick={handleClick}
      slotProps={
        {
          ...slotProps,
          inputLabel: {
            shrink: true,
            ...slotProps?.inputLabel,
          },
        } as React.ComponentProps<typeof TextField>['slotProps']
      }
      sx={{
        ...(color != null ? coloredFieldSx(color) : monospaceFieldSx),
        ...sx,
      }}
    />
  );

  const snackbar = !onClick ? (
    <CopiedToClipboardSnackbar {...snackbarProps} />
  ) : null;

  if (!tooltipMessage) {
    return (
      <>
        {field}
        {snackbar}
      </>
    );
  }

  return (
    <>
      <Tooltip title={formatTooltipTitle(tooltipMessage)} arrow placement="top">
        {field}
      </Tooltip>
      {snackbar}
    </>
  );
}
