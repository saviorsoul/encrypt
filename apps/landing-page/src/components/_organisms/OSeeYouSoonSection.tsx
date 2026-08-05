import { Heading } from '@/components/_atoms/AHeading.tsx';
import { Section } from '@/components/_molecules/MSection.tsx';

const GITHUB_URL = 'https://github.com/saviorsoul/encrypt';
const DISCORD_INVITE_URL = 'https://discord.gg/PAmgfU7ZR9';

export function SeeYouSoonSection() {
  return (
    <Section
      height="content"
      containerClassName="grid gap-y-8 text-center align-center"
    >
      <Heading level={2}>See you soon</Heading>

      <p className="text-xl">
        Follow this project on{' '}
        <a
          className="font-semibold text-brand underline-offset-4 transition-colors hover:text-brand/80 hover:underline"
          href={GITHUB_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          GitHub
        </a>
      </p>

      <p className="text-xl">
        Join us on{' '}
        <a
          className="font-semibold text-brand underline-offset-4 transition-colors hover:text-brand/80 hover:underline"
          href={DISCORD_INVITE_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          Discord
        </a>
      </p>
    </Section>
  );
}
