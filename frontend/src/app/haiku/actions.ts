'use server';

import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { createStreamableValue } from 'ai/rsc';

const SYSTEM_PROMPT = `You are a haiku generator. Create a beautiful and meaningful haiku about the person based on their name and age. 
Follow the traditional 5-7-5 syllable pattern and try to incorporate natural imagery that reflects the person's age.
Always format the haiku with line breaks between each line.`;
const groq = createGroq({
    // custom settings
  });
  const model = groq('gemma2-9b-it');
export async function generate(input: string) {
  const stream = createStreamableValue('');

  (async () => {
    const { textStream } = streamText({
      model: model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: input }
      ]
    });

    for await (const delta of textStream) {
      stream.update(delta);
    }

    stream.done();
  })();

  return { output: stream.value };
} 