export class PrivacyUtils {
    static getInitials(firstName, lastName) {
        const first = firstName?.charAt(0)?.toUpperCase() || '';
        const last = lastName?.charAt(0)?.toUpperCase() || '';
        return first && last ? `${first}${last}` : 'AB';
    }
    static maskName(firstName, lastName) {
        if (!firstName && !lastName) {
            return 'Usuario Anónimo';
        }
        const first = firstName || '';
        const lastInitial = lastName?.charAt(0)?.toUpperCase() || '';
        if (first && lastInitial) {
            return `${first} ${lastInitial}.`;
        }
        return first || 'Usuario';
    }
    static maskEmail(email) {
        if (!email)
            return '***@***.***';
        const [localPart, domain] = email.split('@');
        if (!localPart || !domain)
            return '***@***.***';
        const maskedLocal = localPart.charAt(0) + '***';
        return `${maskedLocal}@${domain}`;
    }
    static maskPhone(phone) {
        if (!phone)
            return '*** *** ****';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length < 4)
            return '*** *** ****';
        const lastFour = cleaned.slice(-4);
        return `*** *** ${lastFour}`;
    }
    static getSafeDisplayName(user) {
        if (!user)
            return 'Verificado por AgroBridge';
        return this.maskName(user.firstName, user.lastName);
    }
}
