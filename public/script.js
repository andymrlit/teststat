document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('connectForm');
    const pairingCodeDisplay = document.getElementById('pairingCodeDisplay');
    const pairingCodeElement = document.getElementById('pairingCode');
    const errorMessage = document.getElementById('errorMessage');
    const loader = document.querySelector('.loader');
    const submitButton = form.querySelector('button[type="submit"]');
    const timerElement = document.getElementById('codeTimer');

    let timer;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Reset previous state
        errorMessage.classList.add('hidden');
        pairingCodeDisplay.classList.add('hidden');
        loader.classList.remove('hidden');
        submitButton.disabled = true;

        const countryCode = document.getElementById('countryCode').value;
        const phoneNumber = document.getElementById('phoneNumber').value;
        const sessionId = document.getElementById('sessionId').value;

        try {
            const response = await fetch('/api/session/create/pair', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId,
                    phoneNumber: countryCode + phoneNumber
                })
            });

            const data = await response.json();

            if (data.success) {
                pairingCodeElement.textContent = data.pairingCode;
                pairingCodeDisplay.classList.remove('hidden');
                
                // Start countdown timer (2 minutes)
                let timeLeft = 120;
                clearInterval(timer);
                timer = setInterval(() => {
                    timeLeft--;
                    if (timeLeft <= 0) {
                        clearInterval(timer);
                        pairingCodeDisplay.classList.add('hidden');
                        timerElement.textContent = '';
                    } else {
                        const minutes = Math.floor(timeLeft / 60);
                        const seconds = timeLeft % 60;
                        timerElement.textContent = `Code expires in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
                    }
                }, 1000);
            } else {
                throw new Error(data.error || 'Failed to generate pairing code');
            }
        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('hidden');
        } finally {
            loader.classList.add('hidden');
            submitButton.disabled = false;
        }
    });
});
