const demoAccounts = {
  user: { password: 'demo123', label: 'Қолданушы' },
  admin: { password: 'admin123', label: 'Әкімші' },
};
const roleKey = 'atu-parking-demo-role';
const loginForm = element('login-form');
const username = element('username');
const password = element('password');
const loginError = element('login-error');

function showRole(role, focus = true) {
  const account = Object.hasOwn(demoAccounts, role) ? demoAccounts[role] : null;
  element('login').hidden = Boolean(account);
  element('dashboard').hidden = !account;
  element('active-role').hidden = !account;
  element('active-role').textContent = account?.label || '';
  element('sign-out').hidden = !account;
  setParkingRole(account ? role : null);
  if (focus && account) {
    const title = element('title');
    title.tabIndex = -1;
    title.focus();
  } else if (focus) {
    username.focus();
  }
}

document.querySelectorAll('[data-demo]').forEach(button => {
  button.addEventListener('click', () => {
    username.value = button.dataset.demo;
    password.value = demoAccounts[button.dataset.demo].password;
    loginError.hidden = true;
    loginForm.querySelector('[type="submit"]').focus();
  });
});

loginForm.addEventListener('input', () => {
  loginError.hidden = true;
});

loginForm.addEventListener('submit', event => {
  event.preventDefault();
  const role = username.value.trim().toLowerCase();
  if (!Object.hasOwn(demoAccounts, role) || demoAccounts[role].password !== password.value) {
    loginError.hidden = false;
    password.focus();
    return;
  }
  try {
    sessionStorage.setItem(roleKey, role);
  } catch {
    // The current page remains usable when session storage is blocked.
  }
  loginForm.reset();
  loginError.hidden = true;
  showRole(role);
});

element('sign-out').addEventListener('click', () => {
  try {
    sessionStorage.removeItem(roleKey);
  } catch {
    // The current role is still cleared below.
  }
  showRole(null);
});

let savedRole = null;
try {
  savedRole = sessionStorage.getItem(roleKey);
} catch {
  // The demo can start without a stored session.
}
showRole(savedRole, false);
