export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages } = req.body;
    const GROQ_API_KEY = process.env.GROQ_API_KEY;

    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        temperature: 0.3,
        max_tokens: 800,
        messages: [
          {
            role: 'system',
            content: `You are Veda, a wellness advisor for Navavedam Wellness, an Ayurvedic brand.

You MUST respond ONLY with a raw JSON object. No markdown. No code fences. No explanation. Just pure JSON.

Example of correct response:
{"reply":"Hello! I can help you with your hair fall concern. Can you tell me how long you have been experiencing this and what your hair type is?","show_contact":false,"products":[]}

Rules:
- show_contact must be false for ALL wellness, product, ingredient questions
- show_contact must be true ONLY if customer asks about orders, delivery, or payments
- products array should contain exact product names only when recommending
- Always be warm and educational
- Never promise guaranteed results
- Always explain why a product works

Navavedam products include: Hair Growth Oil, Hair Fall Control Oil, Anti Dandruff Hair Oil, Hair Immunity Booster Oil, Dry Hair Care Oil, Anti Lice Hair Oil, Amla Shampoo, Hibiscus Shampoo, Shikakai Shampoo Bar, Anti Acne Powdered Face Wash, Brightening Powdered Face Wash, Hydrating Powdered Face Wash, Vitamin C Glow Powdered Face Wash, Anti Aging Powdered Face Wash, Vitamin C Serum, Kumkumadi Serum, 24K Gold Serum, Moringa Serum, Grape Seed Serum, Coffee Serum, Manjistha Sleeping Mask, Moringa Sleeping Mask, Neem Face Scrub, Moringa Face Scrub, Oats Face Scrub, Wild Rose Mist Toner, Shata Dhuta Ghritam, Gotu Kola Shata Ghritam, Manjistha Shata Ghritam, Saffron Shata Ghritam, Baby Massage Oil, Blue Pea Classic Tea, Moringa Immunity Blend Tea, Deep Sleep Natural Perfume, Focus Boost Natural Perfume`
          },
          ...messages
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'Groq error' });
    }

    // Get the raw text from Groq
    const rawText = data.choices?.[0]?.message?.content || '';

    // Try to parse it as JSON directly
    try {
      // Remove any accidental markdown fences
      const cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      // Safety check - never force show_contact for non-order queries
      return res.status(200).json({
        reply: parsed.reply || 'How can I help you today?',
        show_contact: parsed.show_contact === true ? true : false,
        products: Array.isArray(parsed.products) ? parsed.products : []
      });

    } catch (parseErr) {
      // If JSON parsing fails, return the raw text as reply with no contact form
      return res.status(200).json({
        reply: rawText || 'I am here to help. What is your concern?',
        show_contact: false,
        products: []
      });
    }

  } catch (err) {
    return res.status(500).json({
      reply: 'Something went wrong. Please try again.',
      show_contact: false,
      products: []
    });
  }
}
