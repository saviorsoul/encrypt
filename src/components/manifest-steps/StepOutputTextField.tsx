import React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { Theme } from '@mui/material/styles';

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
  ...props
}: StepOutputTextFieldProps) {
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

  if (!tooltipMessage) {
    return field;
  }

  return (
    <Tooltip title={formatTooltipTitle(tooltipMessage)} arrow placement="top">
      {field}
    </Tooltip>
  );
}
