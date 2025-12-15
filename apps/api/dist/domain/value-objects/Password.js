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
    '12345678910',
    'password',
    'password1',
    'password1!',
    'password12',
    'password123',
    'password123!',
    'password1234',
    'qwerty12',
    'qwerty123',
    'qwerty123!',
    'qwerty1234',
    'qwertyuiop',
    'admin123',
    'admin123!',
    'admin1234',
    'administrator',
    'welcome1',
    'welcome1!',
    'welcome12',
    'welcome123',
    'letmein1',
    'letmein1!',
    'letmein123',
    'monkey123',
    'dragon123',
    'master123',
    'login123',
    'abc12345',
    'abc123456',
    'iloveyou1',
    'iloveyou123',
    'sunshine1',
    'sunshine123',
    'princess1',
    'princess123',
    'football1',
    'football123',
    'baseball1',
    'baseball123',
    'soccer123',
    'michael1',
    'michael123',
    'shadow123',
    'ashley123',
    'daniel123',
    'jessica1',
    'jessica123',
    'charlie1',
    'charlie123',
    'superman1',
    'superman123',
    'batman123',
    'spiderman1',
    'qazwsx123',
    'trustno1',
    'trustno1!',
    'passw0rd',
    'passw0rd!',
    'p@ssw0rd',
    'p@ssw0rd!',
    'p@ssword1',
    'p@ssword123',
    'pass1234',
    'pass12345',
    'pass123456',
    'test1234',
    'test12345',
    'testing123',
    'changeme1',
    'changeme!',
    'changeme123',
    'secret123',
    'secret1234',
    'access123',
    'access1234',
    'master1!',
    'hello123',
    'hello123!',
    'hello1234',
    'asdf1234',
    'asdfasdf',
    'asdfghjkl',
    'zxcv1234',
    'zxcvbnm1',
    'qwer1234',
    '1q2w3e4r',
    '1q2w3e4r5t',
    '1qaz2wsx',
    '1qaz2wsx3edc',
    'zaq12wsx',
    'computer1',
    'computer123',
    'internet1',
    'internet123',
    'summer2023',
    'summer2024',
    'summer2025',
    'winter2023',
    'winter2024',
    'winter2025',
    'spring2023',
    'spring2024',
    'spring2025',
    'autumn2023',
    'autumn2024',
    'autumn2025',
    'fall2023',
    'fall2024',
    'fall2025',
    'january2024',
    'february2024',
    'march2024',
    'april2024',
    'december2024',
    'company123',
    'company1!',
    'work1234',
    'office123',
    'business1',
    'enterprise1',
    'corporate1',
    'employee1',
    'user1234',
    'guest1234',
    'temp1234',
    'temppass1',
    'default123',
    'system123',
    'server123',
    'database1',
    'mysql1234',
    'oracle123',
    'cisco1234',
    'juniper123',
    '!qaz2wsx',
    '!qaz@wsx',
    'poiuytrewq',
    'mnbvcxz1',
    'lkjhgfdsa',
    '0987654321',
    '1234qwer',
    'qwer4321',
    'abcd1234',
    'abcd12345',
    '1234abcd',
    'aaaa1111',
    'aaaa1234',
    'aaaaaa11',
    'aa123456',
    'a1234567',
    'a12345678',
    'a123456789',
    'andrew123',
    'anthony1',
    'benjamin1',
    'brandon123',
    'brian1234',
    'carlos123',
    'chris1234',
    'christian1',
    'daniel1234',
    'david1234',
    'diego1234',
    'edward123',
    'fernando1',
    'george123',
    'henry1234',
    'james1234',
    'jason1234',
    'jennifer1',
    'john1234',
    'jonathan1',
    'jordan123',
    'jose12345',
    'joseph123',
    'joshua123',
    'juan12345',
    'justin123',
    'kevin1234',
    'luis12345',
    'maria1234',
    'mark12345',
    'matthew123',
    'miguel1234',
    'nicholas1',
    'oscar1234',
    'patrick123',
    'pedro1234',
    'richard123',
    'robert123',
    'roberto123',
    'ryan12345',
    'samuel123',
    'santiago1',
    'steven123',
    'thomas123',
    'william123',
    'contrasena',
    'contrasena1',
    'contrasena123',
    'clave1234',
    'clave12345',
    'seguro123',
    'secreto123',
    'acceso123',
    'entrada123',
    'mexico123',
    'colombia1',
    'argentina1',
    'peru12345',
    'chile1234',
    'espana123',
    'brasil123',
    'hola12345',
    'amor12345',
    'teamo1234',
    'tequiero1',
    'familia123',
    'amigos123',
    'estrella1',
    'corazon123',
    'angel1234',
    'diablo123',
    'tigre1234',
    'leon12345',
    'aguila123',
    'dragon1234',
    'guerrero1',
    'campeon123',
    'futbol123',
    'america123',
    'chivas123',
    'cruz1234',
    'guadalajara',
    'monterrey1',
    'tijuana123',
    'cancun123',
    'agrobridge1',
    'agro1234',
    'agro12345',
    'agricultura',
    'agricola1',
    'campo1234',
    'rancho123',
    'granja123',
    'cosecha123',
    'siembra123',
    'cultivo123',
    'productor1',
    'producer1',
    'farmer123',
    'farming123',
    'organic123',
    'harvest123',
    'coffee123',
    'cacao1234',
    'banano123',
    'aguacate1',
    'avocado123',
    'mango1234',
    'frutas123',
    'verduras1',
    'developer1',
    'coding123',
    'program123',
    'software1',
    'engineer1',
    'devops123',
    'linux1234',
    'ubuntu123',
    'windows123',
    'macos1234',
    'python123',
    'java12345',
    'javascript',
    'nodejs123',
    'react1234',
    'angular123',
    'docker123',
    'github123',
    'gitlab123',
    'aws1234567',
    'azure1234',
    'cloud1234',
    'security1',
    'hacker123',
    'root12345',
    'admin12345',
    'superuser1',
    'sysadmin1',
    'P@ssword1',
    'P@ssword1!',
    'P@ssw0rd1',
    'P@ssw0rd1!',
    'Passw0rd!',
    'Password1!',
    'Password123!',
    'Welcome1!',
    'Welcome123!',
    'Admin123!',
    'Qwerty123!',
    'Test1234!',
    'Hello123!',
    'Secret123!',
    'Change123!',
    'Temp1234!',
    'User1234!',
    'Login123!',
    'Aa123456',
    'Aa1234567',
    'Aa12345678',
    'Abc12345',
    'Abc123456',
    'Abcd1234',
    'Abcd12345',
    'Ab123456!',
    'Aa123456!',
    'Zz123456',
    'Xx123456',
    '11111111',
    '11112222',
    '12121212',
    '12312312',
    '12341234',
    '12344321',
    '11223344',
    '13131313',
    '14141414',
    '15151515',
    '01234567',
    '00000000',
    '00000001',
    '99999999',
    '88888888',
    '77777777',
    '11111111a',
    '12345678a',
    '123456789a',
    'user1990',
    'user1991',
    'user1992',
    'user1993',
    'user1994',
    'user1995',
    'user1996',
    'user1997',
    'user1998',
    'user1999',
    'user2000',
    'user2001',
    'user2002',
    'password1990',
    'password1995',
    'password2000',
    'pass1990',
    'pass1995',
    'pass2000',
    'p455w0rd',
    'p455word',
    's3cur1ty',
    's3cr3t',
    'h4ck3r',
    'l33t',
    'l33th4x',
    'r00t',
    'adm1n',
    'adm1n123',
    'us3r',
    'us3r123',
    't3st',
    't3st123',
    'letmein!',
    'openme123',
    'opendoor1',
    'opensesame',
    'iamadmin',
    'iamroot',
    'iamuser',
    'mypassword',
    'mypassword1',
    'mypassword123',
    'thisismypassword',
    'dontforget',
    'remember1',
    'forgot123',
    'resetme1',
    'newpassword',
    'newpassword1',
    'oldpassword',
    'mustang1',
    'harley123',
    'corvette1',
    'ferrari1',
    'porsche1',
    'mercedes1',
    'toyota123',
    'honda1234',
    'chevy1234',
    'ford12345',
    'yankees1',
    'redsox123',
    'lakers123',
    'cowboys1',
    'patriots1',
    'rangers123',
    'minecraft1',
    'fortnite1',
    'pokemon123',
    'starwars1',
    'startrek1',
    'matrix123',
    'avatar123',
    'ironman123',
    'captain1',
    'thanos123',
    'infinity1',
    'endgame123',
];
