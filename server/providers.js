// Email providers the app can send through. All use SMTP with a password-type secret
// (authorization code / app password), because that is what works without a registered OAuth app.
// status: 'recommended' | 'ok' | 'limited'
export const PROVIDERS = [
  {
    imap: { host: 'imap.qq.com', port: 993 }, id: 'qq', name: 'QQ Mail', letter: 'Q', color: '#12b7f5', status: 'recommended',
    host: 'smtp.qq.com', port: 465, security: 'ssl', secretLabel: 'Authorization code', placeholder: 'yourname@qq.com',
    blurb: 'Simplest and most reliable in China. No VPN needed.',
    intro: 'QQ Mail does not use your QQ password for apps. You turn on SMTP once and QQ gives you a 16-character authorization code.',
    steps: [
      'Open QQ Mail on the web and sign in.',
      'Go to Settings → Account (账号与安全 / 账户).',
      'Find “POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV service” and switch on **IMAP/SMTP service** (this lets the app send your emails and also read the replies).',
      'Verify with the SMS QQ asks for. QQ then shows a **16-character authorization code**.',
      'Copy it into “Authorization code” in this app. Your QQ password is not used.',
    ],
    links: [{ label: 'Open QQ Mail', url: 'https://mail.qq.com' }],
    tips: ['The code is shown only once. If you lose it, generate a new one (the old one stops working).', 'Use your full address, e.g. 123456@qq.com.'],
  },
  {
    imap: { host: 'imap.163.com', port: 993 }, id: '163', name: '163 Mail', letter: '163', color: '#d6332b', status: 'ok',
    host: 'smtp.163.com', port: 465, security: 'ssl', secretLabel: 'Authorization password', placeholder: 'yourname@163.com',
    blurb: 'NetEase mailbox. Works well in China.',
    intro: 'NetEase mail needs the SMTP service switched on, and uses a separate “client authorization password”.',
    steps: [
      'Sign in at mail.163.com.',
      'Open Settings → POP3/SMTP/IMAP.',
      'Switch on **IMAP/SMTP service** (it is needed to send and to read replies) and confirm by SMS.',
      'Create / copy the **client authorization password** (客户端授权密码).',
      'Paste it into “Authorization password” here, not your login password.',
    ],
    links: [{ label: 'Open 163 Mail', url: 'https://mail.163.com' }],
    tips: ['If you get “authentication failed”, the service is probably still switched off.'],
  },
  {
    imap: { host: 'imap.126.com', port: 993 }, id: '126', name: '126 Mail', letter: '126', color: '#2f7d32', status: 'ok',
    host: 'smtp.126.com', port: 465, security: 'ssl', secretLabel: 'Authorization password', placeholder: 'yourname@126.com',
    blurb: 'NetEase mailbox (126.com).',
    intro: 'Same as 163 Mail: switch on SMTP and use the client authorization password.',
    steps: [
      'Sign in at mail.126.com.',
      'Open Settings → POP3/SMTP/IMAP.',
      'Switch on **IMAP/SMTP service** and confirm by SMS.',
      'Create / copy the **client authorization password**.',
      'Paste it into “Authorization password” here.',
    ],
    links: [{ label: 'Open 126 Mail', url: 'https://mail.126.com' }],
    tips: [],
  },
  {
    imap: { host: 'imap.gmail.com', port: 993 }, id: 'gmail', name: 'Gmail', letter: 'G', color: '#ea4335', status: 'ok',
    host: 'smtp.gmail.com', port: 465, security: 'ssl', secretLabel: 'App password (16 characters)', placeholder: 'you@gmail.com',
    blurb: 'Needs 2-Step Verification and an App Password.',
    intro: 'Google no longer accepts your normal password for apps. You create a 16-character App Password instead (this needs 2-Step Verification).',
    steps: [
      'Open your Google Account → Security and turn on **2-Step Verification** (if it is not on yet).',
      'Open the **App passwords** page (button below).',
      'Type a name such as “Outreach Mailer” and click **Create**.',
      'Copy the 16-character password Google shows (spaces do not matter).',
      'Paste it into “App password” here. Use your full Gmail address as the email.',
    ],
    links: [{ label: 'Security settings', url: 'https://myaccount.google.com/security' }, { label: 'App passwords page', url: 'https://myaccount.google.com/apppasswords' }],
    tips: [
      'In mainland China Gmail is usually blocked. You need a VPN that also allows SMTP, so QQ Mail is the easier choice there.',
      'Free Gmail allows roughly 500 recipients per day (more on Google Workspace). Set a “Daily send cap” in Settings to stay under it.',
      'If the App passwords page is missing, 2-Step Verification is off, or your Workspace admin has disabled it.',
    ],
  },
  {
    imap: { host: 'outlook.office365.com', port: 993 }, id: 'outlook', name: 'Outlook.com / Hotmail', letter: 'O', color: '#0078d4', status: 'limited',
    host: 'smtp-mail.outlook.com', port: 587, security: 'starttls', secretLabel: 'Password / app password', placeholder: 'you@outlook.com',
    blurb: 'Microsoft blocks password sign-in for most personal accounts.',
    intro: 'Microsoft has switched off password sign-in (including app passwords) for SMTP on personal Outlook.com, Hotmail and Live accounts. They only allow OAuth sign-in, which this app does not support yet. Sending usually fails with “basic authentication is disabled”.',
    steps: [
      'Easiest: send from another address (QQ Mail, 163, Gmail, Yahoo …) and fill in **Reply-to** with your Outlook address, so replies still reach you.',
      'You can still try this option: enter your full Outlook address and an app password (account.microsoft.com → Security → App passwords).',
      'If the connection test says “basic authentication is disabled”, Microsoft refused it. Use another provider.',
    ],
    links: [{ label: 'Microsoft account security', url: 'https://account.microsoft.com/security' }],
    tips: ['Microsoft’s own guidance: personal accounts need OAuth2 for SMTP.'],
  },
  {
    imap: { host: 'outlook.office365.com', port: 993 }, id: 'm365', name: 'Microsoft 365 (work / school)', letter: 'M', color: '#d83b01', status: 'limited',
    host: 'smtp.office365.com', port: 587, security: 'starttls', secretLabel: 'Password / app password', placeholder: 'you@yourcompany.com',
    blurb: 'Works only if your admin allows “Authenticated SMTP”.',
    intro: 'Organisations can allow password sign-in for SMTP per mailbox, but Microsoft is switching this off by default during 2026–2027. It may already be blocked for you.',
    steps: [
      'Ask your IT admin to enable **Authenticated SMTP** for your mailbox (Microsoft 365 admin center → Users → your user → Mail → Manage email apps).',
      'If your account uses multi-factor authentication, create an **app password** (My Account → Security info → Add sign-in method → App password) if your organisation allows it.',
      'Enter your full work address and the password / app password here.',
    ],
    links: [{ label: 'My Account security info', url: 'https://mysignins.microsoft.com/security-info' }],
    tips: ['“basic authentication is disabled” means your organisation has switched it off. Use another provider and set Reply-to.'],
  },
  {
    imap: { host: 'imap.mail.yahoo.com', port: 993 }, id: 'yahoo', name: 'Yahoo Mail', letter: 'Y', color: '#6001d2', status: 'ok',
    host: 'smtp.mail.yahoo.com', port: 465, security: 'ssl', secretLabel: 'App password', placeholder: 'you@yahoo.com',
    blurb: 'Needs an app password.',
    intro: 'Yahoo requires an app password for third-party apps.',
    steps: [
      'Sign in to your Yahoo account and open **Account security**.',
      'Turn on two-step verification if it is not on.',
      'Click **Generate app password** (or “Manage app passwords”), name it “Outreach Mailer” and create it.',
      'Copy the password into “App password” here.',
    ],
    links: [{ label: 'Yahoo account security', url: 'https://login.yahoo.com/account/security' }],
    tips: [],
  },
  {
    imap: { host: 'imap.mail.me.com', port: 993 }, id: 'icloud', name: 'iCloud Mail', letter: 'iC', color: '#4b4b50', status: 'ok',
    host: 'smtp.mail.me.com', port: 587, security: 'starttls', secretLabel: 'App-specific password', placeholder: 'you@icloud.com',
    blurb: 'Needs an app-specific password.',
    intro: 'Apple needs an app-specific password for third-party apps (two-factor authentication must be on).',
    steps: [
      'Sign in at appleid.apple.com.',
      'Open **Sign-In and Security → App-Specific Passwords**.',
      'Click **+**, name it “Outreach Mailer”, and create it.',
      'Copy the password into “App-specific password” here, with your full iCloud address.',
    ],
    links: [{ label: 'Apple ID', url: 'https://appleid.apple.com' }],
    tips: [],
  },
  {
    imap: { host: 'imap.zoho.com', port: 993 }, id: 'zoho', name: 'Zoho Mail', letter: 'Z', color: '#e42527', status: 'ok', editableServer: true,
    host: 'smtp.zoho.com', port: 465, security: 'ssl', secretLabel: 'Password / app password', placeholder: 'you@zoho.com',
    blurb: 'Change the server if your account is in another region.',
    intro: 'Zoho uses a different server per data centre. If your login page is zoho.eu / zoho.in / zoho.com.au, change the server below to smtp.zoho.eu / smtp.zoho.in / smtp.zoho.com.au.',
    steps: [
      'Make sure IMAP/SMTP access is enabled in Zoho Mail settings.',
      'If two-factor authentication is on, create an **app-specific password** (accounts.zoho.com → Security → App Passwords).',
      'Enter your full Zoho address and the password / app password here.',
    ],
    links: [{ label: 'Zoho Accounts', url: 'https://accounts.zoho.com' }],
    tips: [],
  },
  {
    imap: { host: '', port: 993 }, id: 'custom', name: 'Other (custom SMTP)', letter: '⚙', color: '#6b7280', status: 'ok', editableServer: true, editableUser: true,
    host: '', port: 465, security: 'ssl', secretLabel: 'Password', placeholder: 'you@yourdomain.com',
    blurb: 'Any mail server: company, university, hosting, relay.',
    intro: 'Use this for any provider that offers SMTP: your university or company mail, a web host, or a relay service.',
    steps: [
      'Look up your provider’s **outgoing (SMTP) server**, port and security. Typical: port **465 = SSL**, port **587 = STARTTLS**.',
      'Enter the host, port and security below, your email address, and your password (or app password).',
      'Some servers want a username that is not your email address. Fill “Username” in that case.',
      'Press **Test connection** to check everything.',
    ],
    links: [],
    tips: ['Only choose “None” for security on a trusted internal server: your password would travel unencrypted.'],
  },
];

// IMAP server used to read replies (same account and password as sending)
export function imapFor(providerId, smtpHost = '') {
  const p = byId(providerId)
  if (p.imap?.host) return { host: p.editableServer && smtpHost ? smtpHost.replace(/^smtp\./, 'imap.') : p.imap.host, port: p.imap.port || 993 }
  return { host: smtpHost.replace(/^smtp\./, 'imap.'), port: 993 }
}

export const byId = (id) => PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];

// Turn a raw SMTP/network error into advice the user can act on.
export function explainImapError(err, providerId) {
  const p = byId(providerId), raw = String(err?.response || err?.message || err || '')
  if (/authenticat|login|credentials|invalid|AUTHENTICATIONFAILED|NO \[AUTH/i.test(raw) || err?.authenticationFailed)
    return `Could not read the mailbox of ${p.name}: login rejected or IMAP is switched off. ${{ qq: 'In QQ Mail settings → Account, switch on IMAP/SMTP service and use the authorization code.', '163': 'In 163 Mail settings switch on IMAP/SMTP service.', '126': 'In 126 Mail settings switch on IMAP/SMTP service.', gmail: 'Use the App Password (IMAP is on by default in Gmail).' }[p.id] || 'Check that IMAP access is enabled and the password is right.'}`
  if (/ENOTFOUND|ECONN|ETIMEDOUT|timed? ?out/i.test(raw + (err?.code || ''))) return `Cannot reach the ${p.name} mailbox server (IMAP). Check your internet or VPN.`
  return `Reading replies failed: ${raw.slice(0, 160)}`
}

export function explainError(err, providerId) {
  const p = byId(providerId);
  const raw = String(err?.response || err?.message || err || '');
  const code = String(err?.code || '');
  if (/5\.7\.139|basic authentication is disabled/i.test(raw))
    return `${p.name} refused the password login (“basic authentication is disabled”). Microsoft only allows OAuth sign-in for this account, which this app does not support. Use another provider such as QQ Mail, Gmail or 163 and set Reply-to to your Outlook address.`;
  if (code === 'EAUTH' || /\b(535|534|530)\b|authentication|auth(orization)? (failed|required)|invalid login|application-specific/i.test(raw)) {
    const hint = { qq: 'Use the SMTP authorization code from QQ Mail settings, not your QQ password, and make sure POP3/SMTP service is switched on.',
      '163': 'Switch on IMAP/SMTP service in 163 Mail settings and use the client authorization password.', '126': 'Switch on IMAP/SMTP service in 126 Mail settings and use the client authorization password.',
      gmail: 'Use a 16-character App Password (2-Step Verification must be on), not your Google password.', yahoo: 'Use an app password generated in Yahoo account security.',
      icloud: 'Use an app-specific password from appleid.apple.com.', m365: 'Your admin must allow Authenticated SMTP, and you may need an app password.',
      outlook: 'Microsoft does not accept password sign-in for most personal accounts.', zoho: 'Check the server region and use an app-specific password if two-factor is on.',
      custom: 'Check the username and password, and whether your server needs the full email address as username.' }[p.id];
    return `Login rejected by ${p.name}. ${hint || ''}`.trim();
  }
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ENOTFOUND', 'ECONNREFUSED', 'EDNS'].includes(code) || /timed? ?out|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(raw))
    return `Cannot reach the ${p.name} server. Check your internet, firewall or VPN.${p.id === 'gmail' || p.id === 'outlook' || p.id === 'm365' ? ' In mainland China this server may be blocked: QQ Mail is the simplest alternative.' : ''}`;
  if (/quota|limit exceeded|too many/i.test(raw)) return `${p.name} says the daily sending limit was reached. Wait a day or lower the “Daily send cap” in Settings.`;
  return raw.slice(0, 240) || 'Sending failed';
}
