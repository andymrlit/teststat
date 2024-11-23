// public/script.js
const API_KEY_STORAGE_KEY = 'whatsapp_api_key';

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const connectForm = document.getElementById('connectForm');
    const authSection = document.getElementById('authSection');
    const connectSection = document.getElementById('connectSection');
    const logoutButton = document.getElementById('logoutButton');
    
    // Check if user is authenticated
    const apiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (apiKey) {
        showConnectSection();
    } else {
        showAuthSection();
    }

    // Registration handler
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('regUsername').value;
        const password = document.getElementById('regPassword').value;
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem(API_KEY_STORAGE_KEY, data.apiKey);
                showConnectSection();
                showToast('Registration successful!', 'success');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            showToast(error.message || 'Registration failed', 'error');
        }
    });

    // WhatsApp connection handler
    connectForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const loader = document.querySelector('.loader');
        const submitButton = connectForm.querySelector('button[type="submit"]');
        const errorMessage = document.getElementById('errorMessage');
        const pairingCodeDisplay = document.getElementById('pairingCodeDisplay');
        
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
                    'X-API-Key': localStorage.getItem(API_KEY_STORAGE_KEY)
                },
                body: JSON.stringify({
                    sessionId,
                    phoneNumber: countryCode + phoneNumber
                })
            });

            const data = await response.json();

            if (data.success) {
                showPairingCode(data.pairingCode);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            showError(error.message);
        } finally {
            loader.classList.add('hidden');
            submitButton.disabled = false;
        }
    });

    // Logout handler
    logoutButton.addEventListener('click', function() {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
        showAuthSection();
    });

    function showPairingCode(code) {
        const pairingCodeElement = document.getElementById('pairingCode');
        const pairingCodeDisplay = document.getElementById('pairingCodeDisplay');
        const timerElement = document.getElementById('codeTimer');
        
        pairingCodeElement.textContent = code;
        pairingCodeDisplay.classList.remove('hidden');
        
        let timeLeft = 120;
        const timer = setInterval(() => {
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
    }

    function showError(message) {
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    function showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white ${
            type === 'error' ? 'bg-red-500' : 'bg-green-500'
        }`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function showConnectSection() {
        authSection.classList.add('hidden');
        connectSection.classList.remove('hidden');
    }

    function showAuthSection() {
        authSection.classList.remove
