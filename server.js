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
  const isIban = lang === 'Bahasa Iban';
  const isKadazan = lang === 'Bahasa Kadazan';

  const langInstr = isBM
    ? 'LANGUAGE: Write entirely in natural, warm Bahasa Malaysia. Everyday Malaysian expressions. NOT formal or stiff.'
    : isIban
    ? 'LANGUAGE: Write entirely in Bahasa Iban â€” the indigenous Iban language of Sarawak, Malaysia. Use authentic Iban vocabulary and cultural references. Include Iban cultural elements like rumah panjai (longhouse), adat, Gawai festival, bejalai (journey), and the rainforests of Sarawak. Sound natural to native Iban speakers.'
    : isKadazan
    ? 'LANGUAGE: Write entirely in Bahasa Kadazan â€” the indigenous Kadazan-Dusun language of Sabah, Malaysia. Use authentic Kadazan vocabulary and cultural references. Include Kadazan cultural elements like walai (longhouse), Pesta Kaamatan harvest festival, momogun (indigenous people), Mount Kinabalu, paddy farming culture, and traditional Kadazan customs. Sound natural to native Kadazan speakers.'
    : 'LANGUAGE: Write in English. Malaysian or Southeast Asian setting encouraged.';


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

  const genreTones = {
    Romance: 'ROMANCE: Must have romantic tension, emotional longing, or love connection. Heartfelt moments, chemistry between characters.',
    Horror: 'HORROR: Must be genuinely SCARY. Build dread and suspense. Include a terrifying twist or psychological fear. Do NOT soften it.',
    Adventure: 'ADVENTURE: Action, movement, excitement. Characters face physical challenges. Fast-paced and thrilling.',
    Comedy: 'COMEDY: Story MUST BE FUNNY. Include jokes, absurd situations, comic misunderstandings, or witty dialogue. Make the reader LAUGH. Humour is the top priority.',
    Mystery: 'MYSTERY: Include a puzzle or secret. Build intrigue and suspense. Include clues and a satisfying reveal at the end.',
    Fantasy: 'FANTASY: Magic, mythical creatures, or fantastical world must be central to the plot.',
    Autobiografi: 'AUTOBIOGRAFI: Entirely first-person. The narrator IS the object â€” it thinks, feels, and experiences uniquely.',
    Fable: 'FABLE: Animal characters with human-like personalities. Must end with a clear moral lesson.',
    Folklore: 'FOLKLORE: Traditional Malaysian/Nusantara legend feel. Mystical elements, kampung setting, ancient wisdom.',
    'Sci-Fi': 'SCI-FI: Futuristic technology, space, or AI must be central to the story.',
  };
  const genreList = genre.split(' + ').map(g => g.trim());
  const toneGuide = genreList.map(g => genreTones[g] || '').filter(Boolean).join(' AND ');
  const blendNote = genreList.length > 1 ? `CRITICAL: Blend ${genreList.join(' AND ')} together. Both elements must be clearly present throughout.` : '';

  const systemPrompt = `You are an expert genre fiction writer. A comedy MUST be funny. A horror MUST be scary. A romance MUST be emotional. You ALWAYS follow the user idea closely while making the genre tone the dominant flavour. Never write a bland or generic story.`;

  const userPrompt = `Write a ${genre} story of ${wordCount} words.

GENRE TONE â€” follow strictly:
${toneGuide}
${blendNote}
${genreInstr}
${langInstr}
${idea ? 'STORY IDEA â€” follow this closely: ' + idea : 'Create an original imaginative story.'}

Rules: clear arc, vivid details, natural dialogue, all-ages appropriate, ${wordCount} words.

Return ONLY JSON:
- "title": max 6 words, same language as story
- "story": full text, paragraph breaks as \n\n

Only JSON. No backticks.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1200,
      temperature: 0.85,
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    res.json({ success: true, title: parsed.title, story: parsed.story });
  } catch (err) {
    console.error('Story error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to generate story' });
  }
});

// â”€â”€â”€ GENERATE COVER IMAGE â€” PRO ONLY (Hugging Face) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/generate-image', async (req, res) => {
  const { genre, storyTitle, isPro } = req.body;

  if (!isPro) {
    return res.status(403).json({ success: false, error: 'Pro feature only' });
  }

  const genrePrompts = {
    Romance:     'romantic scene soft golden light two people bokeh',
    Horror:      'dark horror eerie moonlight fog abandoned house shadows',
    Adventure:   'tropical jungle adventure waterfall golden hour lush',
    Comedy:      'cheerful colorful market scene bright sunny happy',
    Mystery:     'noir mystery rainy city street lamp shadows detective',
    Fantasy:     'magical enchanted forest glowing orbs ethereal mist',
    Autobiografi:'still life single object spotlight dark background',
    Fable:       'animals in forest watercolor storybook warm tones',
    Folklore:    'Malaysian jungle night fireflies temple moonlight',
    'Sci-Fi':    'futuristic cityscape neon lights flying vehicles',
  };

  const styleBase = genrePrompts[genre] || 'cinematic landscape dramatic lighting';
  const titleHint = storyTitle.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 40);
  const imagePrompt = `${styleBase} ${titleHint} book cover art no text high quality`;

  try {
    console.log('Calling HF with prompt:', imagePrompt);
    const hfResponse = await axios({
      method: 'post',
      url: 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1',
      headers: {
        'Authorization': `Bearer ${process.env.HF_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'image/png',
      },
      data: JSON.stringify({ inputs: imagePrompt }),
      responseType: 'arraybuffer',
      timeout: 90000,
    });

    console.log('HF response status:', hfResponse.status);
    const base64 = Buffer.from(hfResponse.data).toString('base64');
    const imageUrl = `data:image/png;base64,${base64}`;
    res.json({ success: true, imageUrl });

  } catch (err) {
    console.error('Image error:', err.message);
    if (err.response) {
      console.error('HF status:', err.response.status);
      const errData = Buffer.from(err.response.data).toString('utf8');
      console.error('HF response:', errData);
      if (err.response.status === 503) {
        return res.status(503).json({ success: false, error: 'Model loading, retry in 20s' });
      }
    }
    res.status(500).json({ success: false, error: 'Failed to generate image' });
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