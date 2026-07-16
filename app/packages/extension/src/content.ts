/// <reference types="chrome" />

// 1. Detect login forms
function detectLoginForm() {
  const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]')) as HTMLInputElement[];
  
  if (passwordInputs.length > 0) {
    const passwordField = passwordInputs[0];
    // Find the associated username field (usually the preceding text/email input)
    let form = passwordField.closest('form');
    let usernameField = form ? form.querySelector('input[type="text"], input[type="email"]') as HTMLInputElement : null;
    
    if (!usernameField) {
      // Fallback heuristic if not in a strict form
      const allInputs = Array.from(document.querySelectorAll('input'));
      const pwIndex = allInputs.indexOf(passwordField);
      if (pwIndex > 0) {
        usernameField = allInputs[pwIndex - 1];
      }
    }

    return { passwordField, usernameField, form };
  }
  
  return null;
}

// 2. Poll for forms and check with background script
let detectionRan = false;

function runDetection() {
  if (detectionRan) return;
  
  const formElements = detectLoginForm();
  if (formElements && formElements.passwordField) {
    detectionRan = true;
    
    // Strict exact origin matching
    const currentOrigin = window.location.origin;
    
    chrome.runtime.sendMessage({ type: 'CHECK_CREDENTIALS', origin: currentOrigin }, (response) => {
      if (response && response.hasCredentials) {
        showAutofillPrompt(formElements, response.credentials);
      }
      
      // Also attach a submit listener to capture NEW credentials if this was an unknown form
      if (formElements.form) {
        formElements.form.addEventListener('submit', () => {
          if (!response || !response.hasCredentials) {
            handleUnknownFormSubmission(formElements.usernameField, formElements.passwordField, currentOrigin);
          }
        });
      }
    });
  }
}

function showAutofillPrompt({ usernameField, passwordField }: any, credentials: any) {
  // Create a small inline UI prompt near the password field
  const prompt = document.createElement('div');
  prompt.style.position = 'absolute';
  prompt.style.zIndex = '999999';
  prompt.style.backgroundColor = '#2563eb';
  prompt.style.color = 'white';
  prompt.style.padding = '4px 8px';
  prompt.style.borderRadius = '4px';
  prompt.style.fontSize = '12px';
  prompt.style.cursor = 'pointer';
  prompt.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
  prompt.textContent = `Autofill ${credentials.username}`;
  
  const rect = passwordField.getBoundingClientRect();
  prompt.style.top = `${window.scrollY + rect.bottom + 5}px`;
  prompt.style.left = `${window.scrollX + rect.left}px`;
  
  prompt.onclick = () => {
    // Fill credentials and dispatch events so modern JS frameworks detect the change
    if (usernameField) {
      usernameField.value = credentials.username;
      usernameField.dispatchEvent(new Event('input', { bubbles: true }));
      usernameField.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    passwordField.value = credentials.password;
    passwordField.dispatchEvent(new Event('input', { bubbles: true }));
    passwordField.dispatchEvent(new Event('change', { bubbles: true }));
    
    prompt.remove();
    
    // Simulated One-Click login could submit the form here if configured
  };
  
  document.body.appendChild(prompt);
}

function handleUnknownFormSubmission(usernameField: HTMLInputElement | null, passwordField: HTMLInputElement, origin: string) {
  const username = usernameField ? usernameField.value : '';
  const password = passwordField.value;
  
  if (password) {
    const save = window.confirm(`VowGuard: Save new password for ${origin}?`);
    if (save) {
      chrome.runtime.sendMessage({ 
        type: 'SAVE_CREDENTIAL', 
        origin, 
        username, 
        password 
      }, (response) => {
        if (response && response.success) {
          alert('VowGuard: Password saved successfully!');
        } else {
          console.error('Failed to save password', response?.error);
        }
      });
    }
  }
}

// Run on load and observe DOM changes for dynamically loaded SPA forms
runDetection();
const observer = new MutationObserver(() => runDetection());
observer.observe(document.body, { childList: true, subtree: true });
