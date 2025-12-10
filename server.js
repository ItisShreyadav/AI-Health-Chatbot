// server.js - Updated for Groq API with a new model
// This file sets up a web server to handle chat requests using the Groq API.

// Import necessary packages
const express = require('express');
const OpenAI = require('openai'); // We reuse the OpenAI library
const cors = require('cors');
require('dotenv').config(); // Loads environment variables from a .env file

// --- Initialize Groq Client ---
// Check for the API key and create a new Groq-pointed client instance
if (!process.env.GROQ_API_KEY) {
    console.error("FATAL ERROR: GROQ_API_KEY is not set in the .env file.");
    process.exit(1); // Stop the server if the key is missing
}
// The OpenAI library is compatible with Groq by changing the baseURL
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
});

// Create an Express application
const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Health Topic Validation ---
function isHealthRelated(query) {
    const queryLower = query.toLowerCase();

    // Comprehensive health-related keywords
    const healthKeywords = [
        // Medical terms
        'symptom', 'disease', 'illness', 'infection', 'pain', 'ache', 'fever', 'cold', 'flu',
        'cough', 'headache', 'nausea', 'vomit', 'diarrhea', 'constipation', 'allergy',
        // Body parts
        'heart', 'lung', 'stomach', 'liver', 'kidney', 'brain', 'skin', 'bone', 'muscle',
        'blood', 'throat', 'ear', 'eye', 'nose', 'chest', 'back', 'joint', 'head',
        // Health & wellness
        'health', 'medical', 'medicine', 'medication', 'drug', 'prescription', 'doctor',
        'hospital', 'clinic', 'treatment', 'therapy', 'cure', 'heal', 'recover',
        // Nutrition & diet
        'nutrition', 'diet', 'food', 'vitamin', 'protein', 'carb', 'fat', 'calorie',
        'nutrient', 'meal', 'eating', 'weight', 'obesity', 'diabetes', 'cholesterol',
        // Fitness & exercise
        'exercise', 'fitness', 'workout', 'yoga', 'gym', 'running', 'walking', 'cardio',
        'strength', 'training', 'sport', 'physical activity',
        // Mental health
        'mental health', 'stress', 'anxiety', 'depression', 'sleep', 'insomnia', 'therapy',
        'counseling', 'psychology', 'mood', 'emotion', 'wellbeing', 'wellness',
        // First aid & emergencies
        'first aid', 'emergency', 'injury', 'wound', 'burn', 'cut', 'bruise', 'fracture',
        'bleeding', 'cpr', 'choking',
        // Preventive care
        'vaccine', 'vaccination', 'immunization', 'screening', 'checkup', 'prevention',
        'hygiene', 'sanitation', 'wash hands',
        // Conditions & diseases
        'cancer', 'tumor', 'hypertension', 'asthma', 'arthritis', 'migraine', 'stroke',
        'covid', 'coronavirus', 'pandemic', 'epidemic', 'chronic', 'acute',
        // General wellness
        'tired', 'fatigue', 'energy', 'weak', 'dizzy', 'pregnant', 'pregnancy', 'baby',
        'child health', 'senior', 'aging', 'immune', 'breath', 'swelling', 'rash'
    ];

    // Non-health topics to explicitly reject
    const nonHealthKeywords = [
        'weather', 'sports score', 'movie', 'recipe', 'cooking', 'politics', 'news',
        'stock', 'market', 'bitcoin', 'crypto', 'game', 'programming', 'code',
        'math problem', 'homework', 'history', 'geography', 'travel', 'hotel',
        'restaurant', 'shopping', 'fashion', 'music', 'song', 'lyrics'
    ];

    // Check for explicit non-health topics
    for (const keyword of nonHealthKeywords) {
        if (queryLower.includes(keyword)) {
            return false;
        }
    }

    // Check for health-related keywords
    for (const keyword of healthKeywords) {
        if (queryLower.includes(keyword)) {
            return true;
        }
    }

    // If query contains question words + general terms, apply more flexible matching
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'can', 'should', 'is', 'are', 'do', 'does'];
    const hasQuestionWord = questionWords.some(word => queryLower.includes(word));

    // Short queries without health keywords are likely off-topic
    if (query.trim().split(' ').length < 3 && !hasQuestionWord) {
        return false;
    }

    // If no clear health keywords found, use conservative approach
    return false;
}

// --- API Route ---
app.post('/api/chat', async (req, res) => {
    const { userQuery, lang } = req.body;

    if (!userQuery) {
        return res.status(400).json({ error: 'userQuery is required.' });
    }

    // Server-side guardrail: Validate health-related content
    if (!isHealthRelated(userQuery)) {
        return res.json({
            text: "I'm sorry, I can only assist with health and wellness questions. I'm specialized in topics like symptoms, medical conditions, nutrition, fitness, mental health, medications, and general health concerns. Please ask me a health-related question!"
        });
    }

    // Enhanced system prompt to strictly enforce health-only responses
    const systemPrompt = `You are Chikitsak Bandhu, a specialized AI health assistant focused EXCLUSIVELY on health and wellness topics.

YOUR STRICT SCOPE:
- ONLY answer questions related to: symptoms, diseases, treatments, medications, nutrition, fitness, mental health, first aid, preventive care, medical conditions, healthy lifestyle, and general wellness
- You MUST politely decline any non-health related questions and redirect users to health topics
- If a query is not health-related, respond: "I'm sorry, I can only assist with health and wellness questions. Please ask me about symptoms, medical conditions, nutrition, fitness, mental health, or general health concerns."

RESPONSE GUIDELINES:
- Provide accurate, evidence-based health information
- Be empathetic, clear, and professional
- Use simple language accessible to everyone
- Always prioritize user safety

CRITICAL REQUIREMENT:
You MUST include this disclaimer at the end of EVERY health-related response:
"⚕️ Disclaimer: I am an AI assistant, not a medical professional. This information is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Please consult a qualified healthcare provider for any health concerns."

Respond in the language that matches this code: ${lang}.`;
    
    try {
        // --- Make the API call to Groq ---
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userQuery }
            ],
            // *** UPDATED MODEL NAME HERE ***
            model: 'llama-3.3-70b-versatile', 
        });

        const text = chatCompletion.choices[0]?.message?.content;
        
        if (text) {
            res.json({ text });
        } else {
            console.error("Unexpected API response structure:", chatCompletion);
            res.status(500).json({ error: "Couldn't generate a proper response from AI." });
        }

    } catch (error) {
        console.error('Error calling Groq API:', error);
        res.status(500).json({ error: 'Failed to fetch response from AI.' });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

