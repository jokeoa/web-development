const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const calculateBMI = (weight, height) => weight / (height * height);

const getBMICategory = (bmi) => {
  if (bmi < 18.5) return { category: 'Underweight', class: 'underweight' };
  if (bmi < 24.9) return { category: 'Normal weight', class: 'normal' };
  if (bmi < 29.9) return { category: 'Overweight', class: 'overweight' };
  return { category: 'Obese', class: 'obese' };
};

const validateInputs = (weight, height) => {
  const errors = [];
  const validateNumber = (value, name) => {
    if (!value || value === '') {
      errors.push(`${name} is required`);
    } else {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        errors.push(`${name} must be a positive number`);
      }
    }
  };
  validateNumber(weight, 'Weight');
  validateNumber(height, 'Height');
  return errors;
};


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/calculate-bmi', (req, res) => {
  const { weight, height } = req.body;
  const errors = validateInputs(weight, height);
  
  if (errors.length > 0) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BMI Calculator - Error</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body>
        <div class="container">
          <div class="card error-card">
            <h1>BMI Calculator</h1>
            <div class="error-message">
              <h2>Validation Error</h2>
              <ul>
                ${errors.map(error => `<li>${error}</li>`).join('')}
              </ul>
            </div>
            <a href="/" class="btn btn-primary">Back to Calculator</a>
          </div>
        </div>
      </body>
      </html>
    `);
  }
  
  const bmi = calculateBMI(parseFloat(weight), parseFloat(height));
  const bmiRounded = Math.round(bmi * 10) / 10;
  const { category, class: categoryClass } = getBMICategory(bmi);
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>BMI Calculator - Result</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <div class="container">
        <div class="card result-card">
          <h1>BMI Calculator</h1>
          <div class="result-section ${categoryClass}">
            <h2>Your BMI Result</h2>
            <div class="bmi-value">${bmiRounded}</div>
            <div class="bmi-category">${category}</div>
            <div class="result-details">
              <p><strong>Weight:</strong> ${weight} kg</p>
              <p><strong>Height:</strong> ${height} m</p>
            </div>
          </div>
          <a href="/" class="btn btn-primary">Calculate Again</a>
        </div>
      </div>
    </body>
    </html>
  `);
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
