export class Password {
    value;
    constructor(value) {
        this.value = value;
    }
    static create(password) {
        const errors = this.validate(password);
        if (errors.length > 0) {
            throw new PasswordValidationError(errors);
        }
        return new Password(password);
    }
    static validate(password) {
        const errors = [];
        if (password.length < 8) {
            errors.push('La contraseña debe tener al menos 8 caracteres');
        }
        if (password.length > 128) {
            errors.push('La contraseña no puede exceder 128 caracteres');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('La contraseña debe contener al menos una letra mayúscula');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('La contraseña debe contener al menos una letra minúscula');
        }
        if (!/\d/.test(password)) {
            errors.push('La contraseña debe contener al menos un número');
        }
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
            errors.push('La contraseña debe contener al menos un carácter especial (!@#$%^&*...)');
        }
        if (/\s/.test(password)) {
            errors.push('La contraseña no puede contener espacios');
        }
        if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
            errors.push('Esta contraseña es demasiado común. Elige otra');
        }
        if (hasSequentialChars(password, 4)) {
            errors.push('La contraseña no puede contener más de 3 caracteres secuenciales');
        }
        if (hasRepeatedChars(password, 4)) {
            errors.push('La contraseña no puede contener más de 3 caracteres repetidos consecutivos');
        }
        return errors;
    }
    static isValid(password) {
        return this.validate(password).length === 0;
    }
    static calculateStrength(password) {
        let score = 0;
        if (password.length >= 8)
            score += 15;
        if (password.length >= 12)
            score += 10;
        if (password.length >= 16)
            score += 10;
        if (password.length >= 20)
            score += 5;
        if (/[a-z]/.test(password))
            score += 10;
        if (/[A-Z]/.test(password))
            score += 10;
        if (/\d/.test(password))
            score += 10;
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password))
            score += 15;
        const charTypes = [
            /[a-z]/.test(password),
            /[A-Z]/.test(password),
            /\d/.test(password),
            /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
        ].filter(Boolean).length;
        if (charTypes >= 3)
            score += 10;
        if (charTypes === 4)
            score += 5;
        if (COMMON_PASSWORDS.includes(password.toLowerCase()))
            score -= 30;
        if (hasSequentialChars(password, 3))
            score -= 10;
        if (hasRepeatedChars(password, 3))
            score -= 10;
        score = Math.max(0, Math.min(100, score));
        let level;
        if (score < 30)
            level = 'Muy débil';
        else if (score < 50)
            level = 'Débil';
        else if (score < 70)
            level = 'Media';
        else if (score < 85)
            level = 'Fuerte';
        else
            level = 'Muy fuerte';
        return {
            score,
            level,
            valid: Password.isValid(password),
        };
    }
    getValue() {
        return this.value;
    }
    toString() {
        return '********';
    }
}
export class PasswordValidationError extends Error {
    errors;
    constructor(errors) {
        super(errors.join('. '));
        this.name = 'PasswordValidationError';
        this.errors = errors;
    }
}
function hasSequentialChars(str, minLength) {
    const sequences = [
        '0123456789',
        'abcdefghijklmnopqrstuvwxyz',
        'qwertyuiop',
        'asdfghjkl',
        'zxcvbnm',
    ];
    const lowerStr = str.toLowerCase();
    for (const seq of sequences) {
        for (let i = 0; i <= seq.length - minLength; i++) {
            const subSeq = seq.substring(i, i + minLength);
            if (lowerStr.includes(subSeq))
                return true;
            if (lowerStr.includes(subSeq.split('').reverse().join('')))
                return true;
        }
    }
    return false;
}
function hasRepeatedChars(str, minLength) {
    const regex = new RegExp(`(.)\\1{${minLength - 1},}`);
    return regex.test(str);
}
const COMMON_PASSWORDS = [
    '12345678',
    '123456789',
    '1234567890',
    'password',
    'password1',
    'password1!',
    'password123',
    'password123!',
    'qwerty123',
    'qwerty123!',
    'admin123',
    'admin123!',
    'welcome1',
    'welcome1!',
    'welcome123',
    'letmein1',
    'letmein1!',
    'monkey123',
    'dragon123',
    'master123',
    'login123',
    'abc12345',
    'abc123456',
    'iloveyou1',
    'sunshine1',
    'princess1',
    'football1',
    'baseball1',
    'michael1',
    'shadow123',
    'ashley123',
    'daniel123',
    'jessica1',
    'charlie1',
    'superman1',
    'qazwsx123',
    'trustno1',
    'passw0rd',
    'passw0rd!',
    'p@ssw0rd',
    'p@ssword1',
    'pass1234',
    'pass12345',
    'test1234',
    'test12345',
    'changeme1',
    'changeme!',
    'secret123',
    'access123',
    'master1!',
    'hello123',
    'hello123!',
    'asdf1234',
    'zxcv1234',
    'qwer1234',
    '1q2w3e4r',
    '1qaz2wsx',
    'summer2024',
    'winter2024',
    'spring2024',
    'autumn2024',
];
