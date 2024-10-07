const fs = require('fs');
const path = require('path');

class I18n {
  constructor() {
    this.language = 'zh';
    this.translations = {};
    this.loadTranslations();
  }

  loadTranslations() {
    const languages = ['en', 'zh'];
    languages.forEach(lang => {
      const filePath = path.join(__dirname, 'locales', `${lang}.json`);
      this.translations[lang] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });
  }

  setLanguage(lang) {
    if (this.translations[lang]) {
      this.language = lang;
    }
  }

  t(key) {
    return this.translations[this.language][key] || key;
  }
}

module.exports = new I18n();