import { ColorfulWord } from '@/components/_atoms/AColorfulWord.tsx';
import { Heading } from '@/components/_atoms/AHeading.tsx';
import { AccentHeadlineText } from '@/components/_molecules/MAccentHeadlineText.tsx';
import { FeedntText } from '@/components/_molecules/MFeedntText.tsx';
import { Section } from '@/components/_molecules/MSection.tsx';

export function AboutFeedntSection() {
  return (
    <Section containerClassName="grid gap-y-12">
      <div>
        <Heading className="text-center" level={2}>
          Enough <ColorfulWord>commercials</ColorfulWord>, what is it all about?
        </Heading>
      </div>

      <div className="paragraph-spacing">
        <p>
          <FeedntText /> is a feed app. The{' '}
          <AccentHeadlineText
            blinkApostrophe={true}
            className="text-brand font-bold"
            text="n't"
          />{' '}
          part in the name is to describe that you, as a user, are not feeding
          it with your own messages. The messages are end-to-end encrypted
          (E2EE) on the users' side. What is kept on the server is the encrypted
          message that only you and recipients can read.
        </p>
        <p>
          The reason to create <FeedntText /> was to encourage free speech and
          increase awareness of encryption mechanisms that can protect
          societies. Reducing the damage of business models which are based on
          selling their own users' data is also something that is pushing this
          project forward.
        </p>
        <p className="font-bold border-l mt-8 pl-2">Why bother?</p>
        <p>
          The issue of today's social media platforms starts with the ability to
          gather an enormous amount of data about their users. What happens
          next? This data is being sold to third-party companies, commercialized
          or just used by the creators for their own goals.
        </p>
        <p>
          On a small scale, intuition of using social media platforms seems
          beneficial:
        </p>
        <p>
          "I have a free app and social network, in return I'm giving some data.
          At the end who cares what I was doing on my vacation."
        </p>
        <p>
          On a large scale, the equation becomes different. And <FeedntText />{' '}
          is all about large scale.{' '}
        </p>
        <p>
          Trusting one party to hold so much data about whole societies is
          risky. Selling data is a business model. Unattended censorship is
          justified as taking care of users. Security breaches just happens.
        </p>
        <p>
          We just need to start thinking about our data at scale. What we
          nowadays call AI gives additional powers to the pattern recognition on
          massive datasets. The risk of uncontrolled data collection has risen.
        </p>
        <p className="font-bold border-l mt-8 pl-2">
          What can we do to minimize the risks?
        </p>
        <p>
          The goal of <FeedntText /> is to show that we can build open-source
          apps that keep their users' data safe, while still offering ethical
          monetization.
        </p>
        <p>
          There should be no need to trust a single person or company if the
          application transparently shows what it does. Unlike other social
          platforms, <FeedntText /> has open-source backend code, so you know
          exactly how data is being stored and served.
        </p>
        <p className="font-bold border-l mt-8 pl-2">
          What about moderation/censorship?
        </p>
        <p>
          Encryption of feed messages and comments has its consequence in data
          being unable to be moderated or censored. Does it mean that you'll be
          stormed by the spam? The core idea is that the network is
          self-organized.
        </p>
        <p>
          To get inside <FeedntText />, you need to be invited by anyone who is
          already in the network. That slow process of getting users can benefit
          this app society long-term. The network will grow organically to
          minimize the amount of fake or non-human accounts. It doesn't mean
          that those types of accounts will not show, but it will be
          significantly easier to manage your own network and what gets into
          your feed.
        </p>
        <p>
          Users are able to block messages from the friend network of particular
          user. It's enough to manage your feed on your own, keeping it just as
          you want it. If someone is sharing information that you don't want to
          see in the future, adjust your network or block particular user's
          messages.
        </p>
        <p className="font-bold border-l mt-8 pl-2">
          What is the algorithm behind feed generation?
        </p>
        <p>
          Simply, there is no algorithm. Users are able to sort messages by
          creation date, last comment date, or share date.
        </p>
      </div>
    </Section>
  );
}
