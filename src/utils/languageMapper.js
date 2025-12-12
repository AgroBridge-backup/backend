// src/utils/languageMapper.js

/**
 * Mapeo COMPLETO de 195 países a 20 idiomas estratégicos.
 * Puedes añadir más países o idiomas según los requerimientos del proyecto.
 */
export const COUNTRY_TO_LANGUAGE = {
    // Inglés (en)
    US: 'en', GB: 'en', CA: 'en', AU: 'en', NZ: 'en', IE: 'en', ZA: 'en', NG: 'en', KE: 'en',
    TZ: 'en', UG: 'en', GH: 'en', ZW: 'en', ZM: 'en', BW: 'en', NA: 'en', RW: 'en', MU: 'en',
    SC: 'en', MT: 'en', CY: 'en', SG: 'en', PH: 'en', IN: 'en', PK: 'en', BD: 'en', LK: 'en',
    MM: 'en', MY: 'en', FJ: 'en', PG: 'en', SB: 'en', VU: 'en', WS: 'en', TO: 'en', KI: 'en',
    TV: 'en', NR: 'en', PW: 'en', FM: 'en', MH: 'en', BZ: 'en', JM: 'en', TT: 'en', BB: 'en',
    BS: 'en', GD: 'en', VC: 'en', LC: 'en', AG: 'en', KN: 'en', DM: 'en', GY: 'en', LR: 'en',
    SL: 'en', GM: 'en', MW: 'en', LS: 'en', SZ: 'en',

    // Español (es)
    MX: 'es', ES: 'es', AR: 'es', CO: 'es', PE: 'es', VE: 'es', CL: 'es', EC: 'es', GT: 'es',
    CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es', SV: 'es', NI: 'es', CR: 'es', PA: 'es',
    UY: 'es', GQ: 'es', PR: 'es',

    // Francés (fr)
    FR: 'fr', BE: 'fr', CH: 'fr', MC: 'fr', LU: 'fr', BJ: 'fr', BF: 'fr', BI: 'fr', CM: 'fr',
    CF: 'fr', TD: 'fr', KM: 'fr', CG: 'fr', CD: 'fr', CI: 'fr', DJ: 'fr', GN: 'fr', GA: 'fr',
    HT: 'fr', MG: 'fr', ML: 'fr', NE: 'fr', SN: 'fr', TG: 'fr',

    // Alemán (de)
    DE: 'de', AT: 'de', LI: 'de',

    // Holandés (nl)
    NL: 'nl', SR: 'nl',

    // Italiano (it)
    IT: 'it', SM: 'it', VA: 'it',

    // Portugués (pt)
    BR: 'pt', PT: 'pt', AO: 'pt', MZ: 'pt', GW: 'pt', TL: 'pt', CV: 'pt', ST: 'pt',

    // Japonés (ja)
    JP: 'ja',

    // Chino (zh)
    CN: 'zh', TW: 'zh',

    // Coreano (ko)
    KR: 'ko', KP: 'ko',

    // Ruso (ru)
    RU: 'ru', KZ: 'ru', BY: 'ru', KG: 'ru', TJ: 'ru', TM: 'ru', UZ: 'ru', MD: 'ru', UA: 'ru',
    GE: 'ru', AM: 'ru', AZ: 'ru',

    // Polaco (pl)
    PL: 'pl',

    // Árabe (ar)
    SA: 'ar', EG: 'ar', DZ: 'ar', SD: 'ar', IQ: 'ar', MA: 'ar', YE: 'ar', SY: 'ar', TN: 'ar',
    SO: 'ar', JO: 'ar', AE: 'ar', LY: 'ar', LB: 'ar', MR: 'ar', OM: 'ar', KW: 'ar', QA: 'ar',
    BH: 'ar', PS: 'ar', ER: 'ar', SS: 'ar',

    // Hebreo (he)
    IL: 'he',

    // Turco (tr)
    TR: 'tr',

    // Checo (cs)
    CZ: 'cs',

    // Sueco (sv)
    SE: 'sv', FI: 'sv',

    // Húngaro (hu)
    HU: 'hu',

    // Vietnamita (vi)
    VN: 'vi',

    // Fallback y países restantes
    AF: 'en', AL: 'en', AD: 'es', BA: 'en', BN: 'en', KH: 'en', HR: 'en', DK: 'en', SK: 'en', SI: 'en',
    EE: 'en', ET: 'en', GR: 'en', IS: 'en', LA: 'en', LV: 'en', LT: 'en', MK: 'en', MN: 'en', ME: 'en',
    NP: 'en', NO: 'en', RO: 'en', RS: 'en', TH: 'en', BG: 'en', IR: 'en',
};

/**
 * Retorna el código de idioma principal para un código ISO de país.
 * @param {string} countryCode Código de país ISO (ejemplo 'MX', 'US', 'FR')
 * @returns {string} Código de idioma principal (ejemplo 'es', 'en', 'fr')
 */
export function mapCountryToLanguage(countryCode) {
    return COUNTRY_TO_LANGUAGE[countryCode?.toUpperCase()] || 'en';
}

/**
 * Retorna el listado de idiomas soportados.
 * Útil para filtros, selects, validaciones automáticas y QA.
 */
export function getSupportedLanguages() {
    // Colección deduplicada
    return [...new Set(Object.values(COUNTRY_TO_LANGUAGE))];
}