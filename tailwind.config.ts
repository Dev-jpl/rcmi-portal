export default {
    content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
    theme: {
        extend: {
            colors: {
                navy: {
                    DEFAULT: '#091f55',
                    50: '#e8ecf5',
                    100: '#c5cfe6',
                    200: '#9badd4',
                    300: '#708bc2',
                    400: '#4f6fb4',
                    500: '#2e53a6',
                    600: '#1a3d85',
                    700: '#122e6b',
                    800: '#091f55',
                    900: '#051540',
                },
                gold: {
                    DEFAULT: '#fce32c',
                    50: '#fffce6',
                    100: '#fff8bf',
                    200: '#fff299',
                    300: '#ffec66',
                    400: '#fce32c',
                    500: '#e6cc00',
                    600: '#b39e00',
                    700: '#806f00',
                    800: '#4d4300',
                    900: '#1a1600',
                },
            },
            fontFamily: {
                heading: ['"Plus Jakarta Sans"', 'sans-serif'],
                body: ['"DM Sans"', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
