document.addEventListener('DOMContentLoaded', () => {
    // Initialize Scroll Animations
    AOS.init({ once: true, offset: 50 });

    // Initialize Typed Text Effect
    if (document.getElementById('typed-text')) {
        new Typed('#typed-text', {
            strings:,
            typeSpeed: 50,
            backSpeed: 30,
            loop: true
        });
    }

    // Human Verification Logic (CAPTCHA)
    const captchaEl = document.getElementById('captchaEquation');
    const answerEl = document.getElementById('captchaAnswer');
    let expectedAnswer = 0;

    function generateCaptcha() {
        const num1 = Math.floor(Math.random() * 10) + 1;
        const num2 = Math.floor(Math.random() * 10) + 1;
        expectedAnswer = num1 + num2;
        captchaEl.textContent = `Calculate: ${num1} + ${num2} =`;
        answerEl.value = '';
    }
    
    generateCaptcha(); // Initialize on load

    // Form Submission and Lead Integration
    const leadForm = document.getElementById('leadForm');
    const formStatus = document.getElementById('formStatus');

    if (leadForm) {
        leadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Validate CAPTCHA
            if (parseInt(answerEl.value, 10)!== expectedAnswer) {
                formStatus.className = 'mt-3 alert alert-danger d-block';
                formStatus.textContent = 'Verification failed. Please solve the math equation correctly.';
                generateCaptcha();
                return;
            }

            const name = document.getElementById('contactName').value;
            const email = document.getElementById('contactEmail').value;
            const subject = document.getElementById('contactSubject').value;
            const message = document.getElementById('contactMessage').value;

            // Transmit data via Telemetry script
            const success = await window.trackPortfolioLead(name, email, subject, message);
            
            formStatus.classList.remove('d-none');
            if (success) {
                formStatus.className = 'mt-3 alert alert-success d-block';
                formStatus.textContent = 'Message securely transmitted to the server.';
                leadForm.reset();
            } else {
                formStatus.className = 'mt-3 alert alert-warning d-block';
                formStatus.textContent = 'Transmission failed. Please try again later.';
            }
            generateCaptcha(); // Reset security challenge
        });
    }
});
