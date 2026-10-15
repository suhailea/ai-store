/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1280px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))',
  				soft: '#e6f2f4'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))',
  				soft: '#fef4e4'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))',
  				icon: 'hsl(var(--sidebar-icon))',
  				amber: 'hsl(var(--sidebar-amber))'
  			},
  			brand: {
  				'700': '#17404d',
  				'800': '#123642',
  				'900': '#0b2530'
  			},
  			ink: {
  				DEFAULT: '#101828',
  				secondary: '#475467',
  				muted: '#667085'
  			},
  			'surface-subtle': '#f7f8fa',
  			'surface-sunken': '#eef1f4',
  			'line-strong': '#d0d5dd',
  			success: {
  				DEFAULT: '#157f4f',
  				soft: '#e8f6ee'
  			},
  			warning: {
  				DEFAULT: '#b45309',
  				soft: '#fef4e4'
  			},
  			danger: {
  				DEFAULT: '#c0362c',
  				soft: '#fdecea'
  			},
  			info: {
  				DEFAULT: '#1d63c8',
  				soft: '#eaf1fc'
  			},
  			'emp-noor': {
  				DEFAULT: '#5e4bc4',
  				soft: '#efedfb'
  			},
  			'emp-layla': {
  				DEFAULT: '#b4366a',
  				soft: '#fcebf2'
  			},
  			'emp-omar': {
  				DEFAULT: '#2f62c9',
  				soft: '#eaf0fc'
  			},
  			'emp-maya': {
  				DEFAULT: '#17774f',
  				soft: '#e6f5ee'
  			},
  			'emp-zayd': {
  				DEFAULT: '#a84c0a',
  				soft: '#fdf0e6'
  			}
  		},
  		borderRadius: {
  			sm: 'var(--radius-sm)',
  			md: 'var(--radius)',
  			lg: 'var(--radius-lg)',
  			full: '9999px'
  		},
  		fontSize: {
  			'2xs': [
  				'11px',
  				{
  					lineHeight: '16px',
  					letterSpacing: '0.06em'
  				}
  			],
  			xs: [
  				'12px',
  				{
  					lineHeight: '16px'
  				}
  			],
  			sm: [
  				'13px',
  				{
  					lineHeight: '18px'
  				}
  			],
  			base: [
  				'14px',
  				{
  					lineHeight: '20px'
  				}
  			],
  			md: [
  				'15px',
  				{
  					lineHeight: '22px'
  				}
  			],
  			lg: [
  				'16px',
  				{
  					lineHeight: '24px'
  				}
  			],
  			xl: [
  				'18px',
  				{
  					lineHeight: '28px'
  				}
  			],
  			'2xl': [
  				'24px',
  				{
  					lineHeight: '32px',
  					letterSpacing: '-0.01em'
  				}
  			],
  			'3xl': [
  				'28px',
  				{
  					lineHeight: '36px',
  					letterSpacing: '-0.02em'
  				}
  			],
  			'4xl': [
  				'30px',
  				{
  					lineHeight: '38px',
  					letterSpacing: '-0.02em'
  				}
  			]
  		},
  		boxShadow: {
  			xs: '0 1px 2px rgba(16,24,40,0.05)',
  			sm: '0 1px 3px rgba(16,24,40,0.08), 0 1px 2px rgba(16,24,40,0.04)',
  			lg: '0 12px 24px -4px rgba(16,24,40,0.12), 0 4px 8px -2px rgba(16,24,40,0.06)'
  		},
  		spacing: {
  			'13': '52px',
  			'15': '60px',
  			'62': '248px',
  			'4.5': '18px'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [],
};
