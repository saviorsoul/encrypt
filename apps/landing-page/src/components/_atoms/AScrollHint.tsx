type ScrollHintProps = {
  opacity: number;
};

export function ScrollHint({ opacity }: ScrollHintProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center"
      style={{ opacity }}
    >
      <span className="text-sm tracking-[0.2em] text-neutral-400 uppercase">
        Scroll
      </span>
    </div>
  );
}
