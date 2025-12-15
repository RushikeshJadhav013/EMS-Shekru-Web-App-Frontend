import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  MessageCircle, 
  Headphones,
  ArrowLeft,
  ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// WhatsApp Logo SVG Component
const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = "h-8 w-8" }) => (
  <svg
    viewBox="0 0 175.216 175.552"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="whatsapp-gradient" x1="85.915" x2="86.535" y1="32.567" y2="137.092" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#57d163"/>
        <stop offset="1" stopColor="#23b33a"/>
      </linearGradient>
    </defs>
    <path fill="url(#whatsapp-gradient)" d="M87.184 25.227c-33.733 0-61.166 27.423-61.178 61.13a60.98 60.98 0 0 0 9.349 32.535l1.455 2.312-6.179 22.559 23.146-6.069 2.235 1.324c9.387 5.571 20.15 8.518 31.126 8.524h.023c33.707 0 61.14-27.426 61.153-61.135a60.75 60.75 0 0 0-17.895-43.251 60.75 60.75 0 0 0-43.235-17.929z"/>
    <path fill="#fff" d="M68.772 55.603c-1.378-3.061-2.828-3.123-4.137-3.176l-3.524-.043c-1.226 0-3.218.46-4.902 2.3s-6.435 6.287-6.435 15.332 6.588 17.785 7.506 19.013 12.718 20.381 31.405 27.75c15.529 6.124 18.689 4.906 22.061 4.6s10.877-4.447 12.408-8.74 1.532-7.971 1.073-8.74-1.685-1.226-3.525-2.146-10.877-5.367-12.562-5.981-2.91-.919-4.137.921-4.746 5.979-5.819 7.206-2.144 1.381-3.984.462-7.76-2.861-14.784-9.124c-5.465-4.873-9.154-10.891-10.228-12.73s-.114-2.835.808-3.751c.825-.824 1.838-2.147 2.759-3.22s1.224-1.84 1.836-3.065.307-2.301-.153-3.22-4.032-10.011-5.666-13.647"/>
  </svg>
);

// Phone Icon SVG Component (Original style)
const PhoneIcon: React.FC<{ className?: string }> = ({ className = "h-7 w-7" }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
  >
    <defs>
      <linearGradient id="phone-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4F46E5"/>
        <stop offset="100%" stopColor="#2563EB"/>
      </linearGradient>
    </defs>
    <path
      d="M3 5a2 2 0 0 1 2-2h3.28a1 1 0 0 1 .948.684l1.498 4.493a1 1 0 0 1-.502 1.21l-2.257 1.13a11.042 11.042 0 0 0 5.516 5.516l1.13-2.257a1 1 0 0 1 1.21-.502l4.493 1.498a1 1 0 0 1 .684.949V19a2 2 0 0 1-2 2h-1C9.716 21 3 14.284 3 6V5z"
      fill="url(#phone-gradient)"
      stroke="url(#phone-gradient)"
      strokeWidth="0.5"
    />
  </svg>
);

// Email Icon SVG Component (Original style)
const EmailIcon: React.FC<{ className?: string }> = ({ className = "h-7 w-7" }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
  >
    <defs>
      <linearGradient id="email-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#9333EA"/>
        <stop offset="100%" stopColor="#7C3AED"/>
      </linearGradient>
    </defs>
    <path
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      stroke="url(#email-gradient)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="url(#email-gradient)"
      fillOpacity="0.2"
    />
  </svg>
);

const ContactSupport: React.FC = () => {
  const navigate = useNavigate();

  const contactMethods = [
    {
      icon: Phone,
      title: '24/7 Phone Support',
      description: 'Call us anytime for immediate assistance',
      details: ['+91 9975072250', '+91 8485050671'],
      action: 'tel:+919975072250',
      actionLabel: 'Call Now',
      color: 'blue'
    },
    {
      icon: MessageCircle,
      title: 'WhatsApp Support',
      description: 'Chat with us on WhatsApp for quick help',
      details: ['+91 9975072250'],
      action: 'https://wa.me/919975072250?text=Hello,%20I%20need%20help%20with%20Shekru%20Web',
      actionLabel: 'Open WhatsApp',
      color: 'green'
    },
    {
      icon: Mail,
      title: 'Email Support',
      description: 'Send us an email and we\'ll respond within 24 hours',
      details: ['support@shekrulabs.com'],
      action: 'mailto:support@shekrulabs.com',
      actionLabel: 'Send Email',
      color: 'purple'
    }
  ];

  const handleWhatsApp = () => {
    window.open('https://wa.me/919975072250?text=Hello,%20I%20need%20help%20with%20Shekru%20Web', '_blank');
  };

  const handleCall = (number: string) => {
    window.location.href = `tel:${number}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-200/30 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Back Button */}
        <div className="relative inline-block mb-4 sm:mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/login')}
            className="relative hover:bg-white/80 active:bg-white/90 text-slate-700 hover:text-slate-900 active:text-slate-900 text-sm sm:text-base transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] border border-transparent hover:border-blue-200"
            aria-label="Go back to login page"
          >
            <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
            <span className="hidden sm:inline">Back to Login</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </div>

        {/* Header */}
        <div className="text-center mb-8 sm:mb-10 lg:mb-12 px-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl blur-lg opacity-60"></div>
              <div className="relative h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl" role="img" aria-label="Customer support headphones icon">
                <Headphones className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-white" aria-hidden="true" />
              </div>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800 mb-2 sm:mb-3">
            We're Here to Help
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-slate-600 max-w-2xl mx-auto px-4">
            Get instant support via phone or WhatsApp 24/7, or email us for detailed inquiries
          </p>
        </div>

        {/* Contact Methods Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 mb-8 sm:mb-10 lg:mb-12 max-w-6xl mx-auto">
          {contactMethods.map((method, index) => {
            // Determine which custom icon to use
            const getCustomIcon = () => {
              if (method.color === 'blue') return <PhoneIcon className="h-6 w-6 sm:h-7 sm:w-7" />;
              if (method.color === 'green') return <WhatsAppIcon className="h-6 w-6 sm:h-7 sm:w-7" />;
              if (method.color === 'purple') return <EmailIcon className="h-6 w-6 sm:h-7 sm:w-7" />;
              return null;
            };

            return (
              <Card key={index} className="bg-white/80 backdrop-blur-xl border-white/20 shadow-lg hover:shadow-2xl transition-all duration-300 sm:hover:scale-105 flex flex-col">
                <CardHeader className="pb-3 sm:pb-4">
                  <div 
                    className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-white flex items-center justify-center mb-3 sm:mb-4 border-2 border-slate-200 shadow-sm"
                    role="img"
                    aria-label={`${method.title} icon`}
                    title={method.title}
                  >
                    {getCustomIcon()}
                  </div>
                  <CardTitle className="text-lg sm:text-xl text-slate-800">{method.title}</CardTitle>
                  <CardDescription className="text-sm sm:text-base text-slate-600">
                    {method.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 flex-1 flex flex-col pt-0">
                  <div className="space-y-1 sm:space-y-2 flex-1">
                    {method.details.map((detail, idx) => (
                      <p key={idx} className="text-slate-700 font-semibold text-base sm:text-lg break-all">
                        {detail}
                      </p>
                    ))}
                  </div>
                  <Button
                    onClick={() => window.open(method.action, method.icon === MessageCircle ? '_blank' : '_self')}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white mt-auto h-10 sm:h-11 text-sm sm:text-base"
                    aria-label={`${method.actionLabel} - ${method.title}`}
                  >
                    {method.actionLabel}
                    <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-2" aria-hidden="true" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick WhatsApp Button */}
        <div className="max-w-2xl mx-auto mb-8 sm:mb-10 lg:mb-12">
          <Card className="bg-gradient-to-r from-green-500 to-emerald-600 border-0 shadow-xl sm:shadow-2xl">
            <CardContent className="p-6 sm:p-8 text-center text-white">
              <div className="h-14 w-14 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 bg-white rounded-full flex items-center justify-center">
                <WhatsAppIcon className="h-10 w-10 sm:h-12 sm:w-12" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-2">Quick WhatsApp Support</h3>
              <p className="mb-4 sm:mb-6 text-sm sm:text-base text-green-50">
                Get instant help via WhatsApp - Available 24/7
              </p>
              <Button
                onClick={handleWhatsApp}
                size="lg"
                className="bg-white text-green-600 hover:bg-green-50 font-semibold text-base sm:text-lg px-6 sm:px-8 h-11 sm:h-12"
                aria-label="Open WhatsApp chat for support"
              >
                <WhatsAppIcon className="h-5 w-5 mr-2" />
                Chat on WhatsApp
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Company Information */}
        <div className="max-w-4xl mx-auto mb-8 sm:mb-10 lg:mb-12">
          <Card className="bg-white/80 backdrop-blur-xl border-white/20 shadow-lg sm:shadow-xl">
            <CardHeader className="pb-4 sm:pb-6">
              <CardTitle className="text-xl sm:text-2xl text-slate-800 flex items-center gap-2">
                <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" aria-hidden="true" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Company Details */}
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-1 sm:mb-2 text-sm sm:text-base">Company Name</h4>
                    <p className="text-slate-600 text-base sm:text-lg">Shekru Labs India PVT. LTD.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-1 sm:mb-2 text-sm sm:text-base">Location</h4>
                    <p className="text-slate-600 flex items-start gap-2 text-sm sm:text-base">
                      <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <span>Pune, Maharashtra, India</span>
                    </p>
                  </div>
                </div>

                {/* Contact Details */}
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-1 sm:mb-2 flex items-center gap-2 text-sm sm:text-base">
                      <Phone className="h-4 w-4 text-blue-600" aria-hidden="true" />
                      Contact Numbers
                    </h4>
                    <div className="space-y-1 sm:space-y-2">
                      <button
                        onClick={() => handleCall('+919975072250')}
                        className="block text-blue-600 hover:text-blue-700 font-medium hover:underline text-sm sm:text-base"
                      >
                        +91 9975072250
                      </button>
                      <button
                        onClick={() => handleCall('+918485050671')}
                        className="block text-blue-600 hover:text-blue-700 font-medium hover:underline text-sm sm:text-base"
                      >
                        +91 8485050671
                      </button>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-1 sm:mb-2 flex items-center gap-2 text-sm sm:text-base">
                      <Clock className="h-4 w-4 text-blue-600" aria-hidden="true" />
                      Support Hours
                    </h4>
                    <p className="text-slate-600 text-sm sm:text-base">24/7 - Always Available</p>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="pt-4 sm:pt-6 border-t border-slate-200">
                <div className="bg-blue-50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-blue-100">
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    <strong className="text-blue-700">Note:</strong> For urgent issues, we recommend using WhatsApp or calling us directly. 
                    Our support team typically responds to emails within 24 hours during business days.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4 sm:mb-6 text-center px-4">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="text-base sm:text-lg text-slate-800">How do I reset my password?</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  Contact our support team via WhatsApp or phone, and we'll help you reset your password securely.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="text-base sm:text-lg text-slate-800">What are your support hours?</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  Our support team is available 24/7 to assist you with any questions or technical issues.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="text-base sm:text-lg text-slate-800">How quickly will I get a response?</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  WhatsApp and phone support: Immediate. Email support: Within 24 hours during business days.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/60 backdrop-blur-sm border-white/20 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="text-base sm:text-lg text-slate-800">Can I schedule a demo?</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  Yes! Contact us via WhatsApp or phone to schedule a personalized demo of our platform.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Floating WhatsApp Button */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
        <button
          onClick={handleWhatsApp}
          className="group relative"
          aria-label="Open WhatsApp chat for instant support"
          title="Chat with us on WhatsApp"
        >
          {/* Pulsing Ring Animation */}
          <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></div>
          
          {/* Main Button */}
          <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-white flex items-center justify-center shadow-2xl hover:shadow-green-500/50 transition-all duration-300 active:scale-95 sm:hover:scale-110">
            <WhatsAppIcon className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>
          
          {/* Tooltip - Hidden on mobile */}
          <div className="hidden sm:block absolute right-full mr-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap shadow-xl">
              Chat on WhatsApp
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rotate-45 w-2 h-2 bg-slate-900"></div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default ContactSupport;
