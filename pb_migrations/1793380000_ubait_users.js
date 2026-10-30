// Runs once, transactionally. No public installer and no password reset on restart.
migrate((app) => {
  const users = new Collection({
    name: 'app_users', type: 'auth',
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null, manageRule: null,
    authRule: 'disabled = false',
    fields: [
      {name: 'username', type: 'text', required: true, min: 3, max: 80, pattern: '^[a-z0-9._@-]+$', presentable: true, help: 'Логин: маленькие латинские буквы, цифры, точка, дефис или подчёркивание.'},
      {name: 'full_name', type: 'text', required: true, min: 3, max: 200, help: 'Полное ФИО точно как в HR / unit.staff. Используется для сопоставления, не для выдачи прав.'},
      {name: 'disabled', type: 'bool', help: 'Включить, чтобы отключить доступ пользователя к сайту.'},
    ],
    indexes: ['CREATE UNIQUE INDEX idx_app_users_username ON app_users (username COLLATE NOCASE)'],
    passwordAuth: {enabled: true, identityFields: ['username']},
    oauth2: {enabled: false}, otp: {enabled: false}, mfa: {enabled: false},
    authAlert: {enabled: false}, authToken: {duration: 28800},
  });
  app.save(users);
  users.fields.getByName('password').min = 12;
  users.fields.getByName('email').required = false;
  users.fields.getByName('email').help = 'Необязательно. Вход выполняется по username, не по почте.';
  app.save(users);
  const email = $os.getenv('PB_ADMIN_EMAIL'), password = $os.getenv('PB_ADMIN_PASSWORD');
  if (!email || password.length < 16) throw new Error('First start requires PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD (at least 16 characters).');
  const admin = new Record(app.findCollectionByNameOrId('_superusers'));
  admin.set('email', email); admin.set('password', password); app.save(admin);
  const settings = app.settings();
  settings.meta.appName = 'УБАИТ — пользователи';
  settings.meta.appURL = $os.getenv('PUBLIC_ORIGIN');
  settings.logs.maxDays = 0;
  // PB is loopback-only. Login limits are enforced by the public Node gateway.
  settings.rateLimits.enabled = false;
  app.save(settings);
});
