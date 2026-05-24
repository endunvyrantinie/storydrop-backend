const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: [
    'https://storydrop-t8ai.vercel.app',
    'http://localhost:3000',
    'http://localhost:5500',
    /\.vercel\.app$/
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// â”€â”€â”€ HEALTH CHECK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/', (req, res) => {
  res.json({ status: 'StoryDrop API is running!' });
});

// â”€â”€â”€ GENERATE STORY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/generate-story', async (req, res) => {
  const { genre, lang, idea, selectedObj, isPro } = req.body;

  const wordCount = isPro ? '400-500' : '300-400';
  const isBM = lang === 'Bahasa Malaysia';

  const langInstr = isBM
    ? 'Write entirely in natural, warm Bahasa Malaysia (not overly formal). Malaysian cultural elements welcome.'
    : 'Write in English. Malaysian or Southeast Asian setting welcome.';

  let genreInstr = '';
  if (genre === 'Autobiografi') {
    const obj = selectedObj || 'sebatang pen';
    genreInstr = isBM
      ? `Ini adalah cerita AUTOBIOGRAFI dari perspektif orang pertama "aku" sebagai ${obj}. Tulis seolah-olah ${obj} itu sendiri bercerita tentang hidupnya. Gaya naratif yang imaginatif dan puitis.`
      : `This is an AUTOBIOGRAPHY from the first-person perspective as ${obj}. Write as if the object itself narrates its life and feelings. Imaginative, poetic style.`;
  } else if (genre === 'Fable') {
    genreInstr = isBM
      ? 'Cerita fabel dengan haiwan sebagai watak utama dan pengajaran moral yang jelas di akhir.'
      : 'A fable with animals as main characters and a clear moral lesson at the end.';
  } else if (genre === 'Folklore') {
    genreInstr = isBM
      ? 'Cerita rakyat atau lagenda bergaya tradisional Malaysia/Nusantara.'
      : 'A folklore or legend in traditional Malaysian/Nusantara style.';
  }

  const prompt = `You are a creative short story writer. Write a ${genre} short story of ${wordCount} words.\n` +
    langInstr + '\n' +
    (genreInstr ? genreInstr + '\n' : '') +
    (idea ? `Story idea: ${idea}` : 'Create an original, imaginative story.') +
    '\n\nRules: clear beginning, middle and end; vivid details; feels complete; all-ages appropriate.' +
    '\n\nReturn ONLY a JSON object with:\n- "title": story title max 6 words (in the same language as the story)\n- "story": full story text, paragraph breaks as \\n\\n\n\nReturn ONLY the JSON. No backticks, no explanation.';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 1200,
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    res.json({ success: true, title: parsed.title, story: parsed.story });
  } catch (err) {
    console.error('Story error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to generate story' });
  }
});
// â”€â”€â”€ VISUALIZE STORY â€” PRO ONLY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/visualize', async (req, res) => {
  const { storyText, isPro } = req.body;

  if (!isPro) {
    return res.status(403).json({ success: false, error: 'Pro feature only' });
  }

  const prompt = `Analyse this short story and extract key information.\n\nStory:\n${storyText}\n\n` +
    'Return ONLY a JSON object with:\n' +
    '- "characters": array of up to 3 objects, each with "name", "role" (Protagonist/Antagonist/Supporting), "desc" (1 sentence)\n' +
    '- "arc": array of exactly 4 objects with "label" and "desc" (max 8 words). Stages: Setup, Conflict, Climax, Resolution\n' +
    '- "theme": one-sentence theme of the story\n\n' +
    'Return ONLY the JSON. No backticks, no explanation.';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 600,
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    res.json({ success: true, ...parsed });
  } catch (err) {
    console.error('Visualize error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to visualize story' });
  }
});

// â”€â”€â”€ START â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`StoryDrop API running on port ${PORT}`);
});