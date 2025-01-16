const express = require('express');
const cors = require('cors');

const app = express();
require('dotenv').config();


const { OpenAI } = require('openai');

// Middleware to parse JSON request bodies
app.use(express.json());

// Enable CORS
app.use(cors());


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


const openai = new OpenAI({
  apiKey: process.env.turnKey, 
});

app.post('/generate', async (req, res) => {


const {idea} = req.body;


  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an assistant that generates code for web applications.',
        },
        {
          role: 'user',
                content: `I will give you an idea and I want you to please provide only the HTML, CSS, and JavaScript code in a single HTML file. Do not include any other text, explanations, or extra information. Only the code should be returned for the followiing idea: ${idea}`,
        },
      ],
    });

    const generatedCode = completion.choices[0].message.content;
res.status(200).send(generatedCode);



}
catch(error){
                res.status(200).send(html);

  console.log("Oopsies encountered");
  console.log(error);

}


});

// Get the generated app idea
app.get('/idea', (req, res) => {
  res.status(200).json(html);
});



// Handle invalid endpoints
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start the server
const PORT = 5002;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
