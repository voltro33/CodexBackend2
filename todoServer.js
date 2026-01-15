const express = require('express');
const cors = require('cors');

const app = express();
require('dotenv').config();

const { OpenAI } = require('openai');

// Middleware to parse JSON request bodies
app.use(express.json());

// Enable CORS
app.use(cors());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.turnKey,
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Strips markdown code blocks from AI response
 * Handles ```html, ```javascript, ``` etc.
 */
function stripMarkdownCodeBlocks(code) {
  if (!code) return code;
  
  // Remove opening code fence with optional language tag
  let cleaned = code.replace(/^```(?:html|javascript|js|css|htm)?\s*\n?/i, '');
  
  // Remove closing code fence
  cleaned = cleaned.replace(/\n?```\s*$/i, '');
  
  return cleaned.trim();
}

/**
 * Get system prompt based on app type
 */
function getSystemPrompt(appType, style) {
  const basePrompt = `You are an expert web developer that generates complete, production-ready web applications. 
You create beautiful, interactive, and functional single-file HTML applications with embedded CSS and JavaScript.

CRITICAL RULES:
1. Return ONLY the raw HTML code - no markdown, no explanations, no code fences
2. Include ALL code in a single HTML file (embedded <style> and <script> tags)
3. Make the UI modern, responsive, and visually appealing
4. Add smooth animations and transitions where appropriate
5. Ensure the app is fully functional and interactive
6. Use semantic HTML5 elements
7. Include error handling in JavaScript
8. Make it mobile-friendly with proper viewport settings`;

  const typePrompts = {
    game: `\n\nSPECIALIZATION: You are creating a GAME. Focus on:
- Smooth animations using requestAnimationFrame
- Keyboard/mouse/touch controls
- Score tracking and game states
- Visual feedback and sound effects (using Web Audio API if needed)
- Clear instructions for the player`,

    tool: `\n\nSPECIALIZATION: You are creating a UTILITY/TOOL app. Focus on:
- Clean, intuitive user interface
- Clear input/output sections
- Data validation and error messages
- Copy-to-clipboard functionality where relevant
- Local storage for saving user preferences`,

    landing: `\n\nSPECIALIZATION: You are creating a LANDING PAGE. Focus on:
- Eye-catching hero section
- Smooth scroll animations
- Call-to-action buttons
- Testimonials or feature sections
- Professional typography and spacing`,

    dashboard: `\n\nSPECIALIZATION: You are creating a DASHBOARD. Focus on:
- Data visualization (charts, graphs using Canvas or SVG)
- Clean card-based layout
- Real-time updates simulation
- Filtering and sorting options
- Responsive grid layout`,

    form: `\n\nSPECIALIZATION: You are creating a FORM/SURVEY app. Focus on:
- Multi-step form with progress indicator
- Input validation with helpful error messages
- Smooth transitions between steps
- Success/completion state
- Accessible form controls`,

    creative: `\n\nSPECIALIZATION: You are creating a CREATIVE/ART app. Focus on:
- Canvas-based drawing or animations
- Color pickers and creative controls
- Export/save functionality
- Undo/redo capabilities
- Impressive visual effects`
  };

  const stylePrompts = {
    modern: `\n\nSTYLE: Modern minimalist - clean lines, lots of whitespace, subtle shadows, rounded corners, gradient accents.`,
    retro: `\n\nSTYLE: Retro/vintage - pixel art aesthetic, bold colors, chunky borders, nostalgic feel.`,
    neon: `\n\nSTYLE: Neon/cyberpunk - dark background, glowing neon colors, futuristic feel, animated glows.`,
    glassmorphism: `\n\nSTYLE: Glassmorphism - frosted glass effects, transparency, soft shadows, vibrant backgrounds.`,
    brutalist: `\n\nSTYLE: Brutalist - bold typography, high contrast, unconventional layouts, raw aesthetic.`,
    playful: `\n\nSTYLE: Playful/fun - bright colors, bouncy animations, rounded shapes, friendly feel.`
  };

  let prompt = basePrompt;
  prompt += typePrompts[appType] || typePrompts.tool;
  prompt += stylePrompts[style] || stylePrompts.modern;

  return prompt;
}

/**
 * Available models configuration
 */
const MODELS = {
  // GPT-5 Series (Newest)
  'gpt-5': { name: 'gpt-5', description: 'Most powerful, best quality' },
  'gpt-5-mini': { name: 'gpt-5-mini', description: 'GPT-5 speed optimized' },
  'gpt-5-nano': { name: 'gpt-5-nano', description: 'GPT-5 fastest, lightweight' },
  
  // GPT-4.1 Family
  'gpt-4.1': { name: 'gpt-4.1', description: 'Great for coding & long context' },
  'gpt-4.1-mini': { name: 'gpt-4.1-mini', description: 'Fast and efficient' },
  'gpt-4.1-nano': { name: 'gpt-4.1-nano', description: 'Lightweight, fastest' },
  
  // GPT-4o Family
  'gpt-4o': { name: 'gpt-4o', description: 'Highly capable, multimodal' },
  'gpt-4o-mini': { name: 'gpt-4o-mini', description: 'Fast and cost-effective' },
  
  // O-Series Reasoning Models
  'o3': { name: 'o3', description: 'Advanced reasoning' },
  'o3-mini': { name: 'o3-mini', description: 'Reasoning, lighter' },
  'o4-mini': { name: 'o4-mini', description: 'Reasoning + vision' },
};


let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tennis Game</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background-color: #8BCA2B; /* Tennis court background */
        }

        canvas {
            border: 2px solid #fff;
            background-color: #2e8b57;
        }

        .score {
            position: absolute;
            top: 10px;
            font-size: 24px;
            color: white;
        }
    </style>
</head>
<body>

<canvas id="gameCanvas" width="600" height="400"></canvas>
<div class="score">
    Player 1: <span id="score1">0</span> | Player 2: <span id="score2">0</span>
</div>

<script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const paddleWidth = 10, paddleHeight = 60, ballRadius = 10;

    let player1Y = (canvas.height - paddleHeight) / 2, player2Y = (canvas.height - paddleHeight) / 2;
    let ballX = canvas.width / 2, ballY = canvas.height / 2;
    let ballSpeedX = 5, ballSpeedY = 5;
    let player1Score = 0, player2Score = 0;

    const paddleSpeed = 20;
    let upPressed = false, downPressed = false, wPressed = false, sPressed = false;

    function drawPaddles() {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, player1Y, paddleWidth, paddleHeight); // Player 1's paddle
        ctx.fillRect(canvas.width - paddleWidth, player2Y, paddleWidth, paddleHeight); // Player 2's paddle
    }

    function drawBall() {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    function moveBall() {
        ballX += ballSpeedX;
        ballY += ballSpeedY;

        if (ballY + ballRadius > canvas.height || ballY - ballRadius < 0) {
            ballSpeedY = -ballSpeedY; // Ball hits top or bottom
        }

        // Ball collision with paddles
        if (ballX - ballRadius < paddleWidth && ballY > player1Y && ballY < player1Y + paddleHeight) {
            ballSpeedX = -ballSpeedX;
            player1Score++;
            updateScore();
        } else if (ballX + ballRadius > canvas.width - paddleWidth && ballY > player2Y && ballY < player2Y + paddleHeight) {
            ballSpeedX = -ballSpeedX;
            player2Score++;
            updateScore();
        }

        // Ball out of bounds
        if (ballX < 0 || ballX > canvas.width) {
            resetBall();
        }
    }

    function resetBall() {
        ballX = canvas.width / 2;
        ballY = canvas.height / 2;
        ballSpeedX = -ballSpeedX;
    }

    function movePaddles() {
        if (wPressed && player1Y > 0) {
            player1Y -= paddleSpeed; // Move Player 1 up
        }
        if (sPressed && player1Y < canvas.height - paddleHeight) {
            player1Y += paddleSpeed; // Move Player 1 down
        }
        if (upPressed && player2Y > 0) {
            player2Y -= paddleSpeed; // Move Player 2 up
        }
        if (downPressed && player2Y < canvas.height - paddleHeight) {
            player2Y += paddleSpeed; // Move Player 2 down
        }
    }

    function updateScore() {
        document.getElementById('score1').textContent = player1Score;
        document.getElementById('score2').textContent = player2Score;
    }

    function gameLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawPaddles();
        drawBall();
        moveBall();
        movePaddles();
        requestAnimationFrame(gameLoop);
    }

    window.addEventListener('keydown', function(event) {
        if (event.key === 'w') wPressed = true;
        if (event.key === 's') sPressed = true;
        if (event.key === 'ArrowUp') upPressed = true;
        if (event.key === 'ArrowDown') downPressed = true;
    });

    window.addEventListener('keyup', function(event) {
        if (event.key === 'w') wPressed = false;
        if (event.key === 's') sPressed = false;
        if (event.key === 'ArrowUp') upPressed = false;
        if (event.key === 'ArrowDown') downPressed = false;
    });

    gameLoop();
</script>

</body>
</html>

`;




// ============================================
// API ENDPOINTS
// ============================================

/**
 * POST /generate
 * Generate a web application from an idea
 * 
 * Body parameters:
 * - idea (required): The app idea/description
 * - type (optional): 'game' | 'tool' | 'landing' | 'dashboard' | 'form' | 'creative'
 * - style (optional): 'modern' | 'retro' | 'neon' | 'glassmorphism' | 'brutalist' | 'playful'
 * - model (optional): 'gpt-4o' | 'gpt-4o-mini' | 'o3-mini'
 */
app.post('/generate', async (req, res) => {
  const { idea, type = 'tool', style = 'modern', model = 'gpt-4o' } = req.body;

  // Validate required field
  if (!idea || typeof idea !== 'string' || idea.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid "idea" field. Please provide a description of the app you want to create.',
    });
  }

  // Validate model
  const selectedModel = MODELS[model] ? model : 'gpt-4o';

  try {
    console.log(`🚀 Generating app: "${idea.substring(0, 50)}..." | Type: ${type} | Style: ${style} | Model: ${selectedModel}`);

    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(type, style),
        },
        {
          role: 'user',
          content: `Create this application: ${idea}

Remember: Return ONLY the complete HTML code, nothing else. No markdown, no explanations, no code fences. Just pure HTML that can be directly rendered in a browser.`,
        },
      ],
    });

    let generatedCode = completion.choices[0].message.content;

    // Strip any markdown code blocks that might have slipped through
    generatedCode = stripMarkdownCodeBlocks(generatedCode);

    // Validate that we got HTML back
    if (!generatedCode.toLowerCase().includes('<!doctype html') && 
        !generatedCode.toLowerCase().includes('<html')) {
      // If no HTML structure, wrap it
      if (generatedCode.includes('<')) {
        generatedCode = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Generated App</title>\n</head>\n<body>\n${generatedCode}\n</body>\n</html>`;
      } else {
        throw new Error('Generated content does not appear to be valid HTML');
      }
    }

    console.log(`✅ Successfully generated app (${generatedCode.length} characters)`);

    res.status(200).send(generatedCode);

  } catch (error) {
    console.error('❌ Generation error:', error.message);

    // Return proper error response
    if (error.code === 'insufficient_quota') {
      return res.status(503).json({
        success: false,
        error: 'API quota exceeded. Please try again later.',
        fallback: true,
      });
    }

    if (error.code === 'invalid_api_key') {
      return res.status(503).json({
        success: false,
        error: 'API configuration error. Please contact support.',
        fallback: true,
      });
    }

    // For other errors, return fallback with error info
    return res.status(500).json({
      success: false,
      error: 'Failed to generate app. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      fallback: true,
      fallbackUrl: '/idea',
    });
  }
});

/**
 * POST /generate-stream
 * Generate a web application with streaming response (for faster perceived performance)
 */
app.post('/generate-stream', async (req, res) => {
  const { idea, type = 'tool', style = 'modern', model = 'gpt-4o' } = req.body;

  if (!idea || typeof idea !== 'string' || idea.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid "idea" field.',
    });
  }

  const selectedModel = MODELS[model] ? model : 'gpt-4o';

  try {
    console.log(`🚀 Streaming generation: "${idea.substring(0, 50)}..." | Type: ${type} | Style: ${style}`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const stream = await openai.chat.completions.create({
      model: selectedModel,
      messages: [
        {
          role: 'system',
          content: getSystemPrompt(type, style),
        },
        {
          role: 'user',
          content: `Create this application: ${idea}\n\nReturn ONLY the complete HTML code, nothing else.`,
        },
      ],
      stream: true,
    });

    let fullContent = '';
    let isFirstChunk = true;
    let lastChunkTime = Date.now();

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullContent += content;
      lastChunkTime = Date.now();

      // Skip markdown code fence at the start
      if (isFirstChunk && fullContent.startsWith('```')) {
        continue;
      }
      isFirstChunk = false;

      res.write(content);
    }

    // Clean up any trailing code fence
    if (fullContent.endsWith('```')) {
      console.log('Note: Response had trailing code fence');
    }

    res.end();
    console.log(`✅ Stream complete (${fullContent.length} characters)`);

  } catch (error) {
    console.error('❌ Stream error:', error.message);
    console.error('   Full error:', JSON.stringify(error, null, 2));
    
    // Send error message to client if response not yet sent
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      // Headers already sent, just end the response
      res.end(`\n\n<!-- Error: ${error.message} -->`);
    }
  }
});

/**
 * GET /idea
 * Returns the fallback demo app (Tennis game)
 */
app.get('/idea', (req, res) => {
  res.status(200).send(html);
});

/**
 * GET /options
 * Returns available app types, styles, and models
 */
app.get('/options', (req, res) => {
  res.status(200).json({
    types: [
      { id: 'game', name: 'Game', description: 'Interactive games with animations and controls' },
      { id: 'tool', name: 'Tool/Utility', description: 'Useful tools and utilities' },
      { id: 'landing', name: 'Landing Page', description: 'Marketing and promotional pages' },
      { id: 'dashboard', name: 'Dashboard', description: 'Data visualization and analytics' },
      { id: 'form', name: 'Form/Survey', description: 'Interactive forms and surveys' },
      { id: 'creative', name: 'Creative/Art', description: 'Artistic and creative applications' },
    ],
    styles: [
      { id: 'modern', name: 'Modern', description: 'Clean, minimal design with subtle shadows' },
      { id: 'retro', name: 'Retro', description: 'Vintage pixel-art aesthetic' },
      { id: 'neon', name: 'Neon/Cyberpunk', description: 'Dark theme with glowing accents' },
      { id: 'glassmorphism', name: 'Glassmorphism', description: 'Frosted glass effects' },
      { id: 'brutalist', name: 'Brutalist', description: 'Bold, unconventional design' },
      { id: 'playful', name: 'Playful', description: 'Bright colors and bouncy animations' },
    ],
    models: [
      { id: 'gpt-5', name: 'GPT-5', description: 'Most powerful' },
      { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'GPT-5 optimized' },
      { id: 'gpt-5-nano', name: 'GPT-5 Nano', description: 'GPT-5 fastest' },
      { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Great for coding' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Fast and balanced' },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Multimodal' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Cost-effective' },
      { id: 'o3', name: 'O3', description: 'Advanced reasoning' },
      { id: 'o4-mini', name: 'O4 Mini', description: 'Reasoning + vision' },
    ],
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Handle invalid endpoints
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'POST /generate - Generate an app from an idea',
      'POST /generate-stream - Generate with streaming response',
      'GET /idea - Get fallback demo app',
      'GET /options - Get available types, styles, and models',
      'GET /health - Health check',
    ],
  });
});

// Start the server
const PORT = 5002;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
