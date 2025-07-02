export type ThemeName = 'default' | 'dark';

export interface Theme {
    mapBackground: string;
    textColor: string;
    // Add other theme properties as needed
}

export const themes: Record<ThemeName, Theme> = {
    default: {
        mapBackground: '#FFFFFF', // White
        textColor: '#000000',   // Black
    },
    dark: {
        mapBackground: '#222222', // Dark grey
        textColor: '#FFFFFF',   // White
    },
};
