export const Validators = {
  email: (email: string): string | null => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) return 'Email-ul este obligatoriu.';
    if (!re.test(email)) return 'Email invalid.';
    return null;
  },

  password: (password: string): string | null => {
    if (!password) return 'Parola este obligatorie.';
    if (password.length < 6) return 'Parola trebuie să aibă cel puțin 6 caractere.';
    return null;
  },

  name: (name: string): string | null => {
    if (!name.trim()) return 'Numele este obligatoriu.';
    if (name.trim().length < 2) return 'Numele trebuie să aibă cel puțin 2 caractere.';
    return null;
  },

  weight: (value: number, unit: 'kg' | 'g' = 'kg'): string | null => {
    if (isNaN(value)) return 'Valoare invalidă.';
    if (unit === 'kg' && (value < 0 || value > 50)) return 'Greutatea trebuie să fie între 0 și 50 kg.';
    if (unit === 'g' && (value < 0 || value > 50000)) return 'Greutatea trebuie să fie între 0 și 50000 g.';
    return null;
  },

  height: (value: number): string | null => {
    if (isNaN(value)) return 'Valoare invalidă.';
    if (value < 30 || value > 200) return 'Înălțimea trebuie să fie între 30 și 200 cm.';
    return null;
  },

  headCircumference: (value: number): string | null => {
    if (isNaN(value)) return 'Valoare invalidă.';
    if (value < 25 || value > 60) return 'Perimetrul cranian trebuie să fie între 25 și 60 cm.';
    return null;
  },

  bloodPressure: (systolic: number, diastolic: number): string | null => {
    if (systolic < 60 || systolic > 200) return 'Tensiunea sistolică trebuie să fie între 60-200 mmHg.';
    if (diastolic < 40 || diastolic > 130) return 'Tensiunea diastolică trebuie să fie între 40-130 mmHg.';
    return null;
  },

  glucose: (value: number): string | null => {
    if (value < 30 || value > 400) return 'Glicemia trebuie să fie între 30-400 mg/dL.';
    return null;
  },

  lmpDate: (date: Date): string | null => {
    const now = new Date();
    const maxOld = new Date();
    maxOld.setDate(maxOld.getDate() - 42 * 7); // 42 săptămâni înapoi
    if (date > now) return 'Data nu poate fi în viitor.';
    if (date < maxOld) return 'Data este prea veche (maxim 42 săptămâni).';
    return null;
  },

  required: (value: string, fieldName: string): string | null => {
    if (!value?.trim()) return `${fieldName} este obligatoriu.`;
    return null;
  },
};
