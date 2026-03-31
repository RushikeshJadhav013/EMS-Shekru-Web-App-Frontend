import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  X, 
  Clock, 
  Users, 
  ClipboardList, 
  PlusCircle, 
  Check, 
  Mail, 
  Phone,
  Home,
  Layout,
  Info,
  DollarSign
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const [showEnquiryModal, setShowEnquiryModal] = useState(false);
    const [showPlansModal, setShowPlansModal] = useState(false);
    const [showAboutModal, setShowAboutModal] = useState(false);

    // Timed pop-up after 4-5 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowEnquiryModal(true);
        }, 4000);
        return () => clearTimeout(timer);
    }, []);

    const features = [
        {
            title: "Employee Management",
            desc: "Track employee data, performance, and records efficiently.",
            icon: Users,
            color: "text-emerald-400"
        },
        {
            title: "Attendance System",
            desc: "Automate attendance tracking with real-time insights.",
            icon: Clock,
            color: "text-emerald-400"
        },
        {
            title: "Payroll",
            desc: "Manage salaries, bonuses, and payslips seamlessly.",
            icon: DollarSign,
            color: "text-emerald-400"
        },
        {
            title: "Recruitment",
            desc: "Hire smarter with streamlined recruitment tools.",
            icon: PlusCircle,
            color: "text-emerald-400"
        }
    ];

    const plans = [
        {
            name: "Silver",
            price: "₹999",
            period: "per month",
            features: ["Up to 10 Employees", "Basic Attendance", "Core HR", "Support"],
            recommended: false
        },
        {
            name: "Gold",
            price: "₹1,999",
            period: "per month",
            features: ["Up to 50 Employees", "Advanced Attendance", "Payroll Mgmt", "Priority Support", "Project Tracking"],
            recommended: true
        },
        {
            name: "Platinum",
            price: "Custom",
            period: "contact us",
            features: ["Unlimited Employees", "All Features", "Dedicated Manager", "24/7 Support", "API Access", "Custom Integration"],
            recommended: false
        }
    ];

    return (
        <div className="relative min-h-screen font-sans selection:bg-emerald-500/30 overflow-x-hidden">
            {/* Background Image with Overlay */}
            <div 
                className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000 scale-105"
                style={{ 
                    backgroundImage: `url('/landing-bg.png')`, 
                }}
            >
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]" />
            </div>

            {/* Main Content Layer */}
            <div className="relative z-10 container mx-auto px-4 lg:px-6 min-h-screen flex flex-col pt-8 lg:pt-12">
                {/* Navbar */}
                <nav className="flex items-center justify-between backdrop-blur-md bg-white/10 border border-white/10 px-6 py-3 rounded-2xl mb-8 lg:mb-14">
                    <Logo 
                        iconClassName="h-8 w-8" 
                        textClassName="text-xl font-bold text-white tracking-tight"
                    />
                    
                    <div className="hidden md:flex items-center gap-8">
                        <button onClick={() => window.location.reload()} className="text-white hover:text-emerald-400 transition-colors font-semibold flex items-center gap-2 text-sm">
                             Home
                        </button>
                        <button onClick={() => setShowPlansModal(true)} className="text-white hover:text-emerald-400 transition-colors font-semibold flex items-center gap-2 text-sm">
                             Plan
                        </button>
                        <button onClick={() => setShowAboutModal(true)} className="text-white hover:text-emerald-400 transition-colors font-semibold flex items-center gap-2 text-sm">
                             About
                        </button>
                    </div>

                    <Button 
                        onClick={() => navigate('/login')}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold px-6 rounded-xl h-9 text-sm"
                    >
                        Login
                    </Button>
                </nav>

                {/* Hero Section */}
                <div className="flex-grow flex flex-col items-center justify-center text-center max-w-4xl mx-auto px-4 pb-12">
                    <h1 className="text-4xl lg:text-6xl font-extrabold text-white mb-4 drop-shadow-2xl leading-[1.1]">
                        Smart HR Management System
                    </h1>
                    <p className="text-base lg:text-lg text-slate-200 mb-8 opacity-90 leading-relaxed font-medium max-w-2xl">
                        Manage employees, payroll, attendance and recruitment in one powerful platform.
                    </p>
                    
                    <Button 
                        onClick={() => setShowEnquiryModal(true)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 text-base font-black px-10 py-5 rounded-xl shadow-xl shadow-emerald-500/20 transform hover:scale-105 transition-all mb-12 h-12"
                    >
                        Get Started
                    </Button>

                    {/* Feature Cards in Hero */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full mt-4">
                        {features.map((f, i) => (
                            <div key={i} className="backdrop-blur-xl bg-white/10 border border-white/20 p-5 rounded-2xl hover:bg-white/15 transition-all text-left group">
                                <h3 className={`text-base font-bold ${f.color} mb-2 flex items-center gap-2`}>
                                   {f.title}
                                </h3>
                                <p className="text-slate-200 text-xs leading-relaxed font-medium">
                                    {f.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <footer className="text-center py-8 text-slate-400 text-sm font-medium">
                    © 2026 Shekru Labs India Pvt.Ltd | Designed with transparency UI
                </footer>
            </div>

            {/* Enquiry Form Modal */}
            {showEnquiryModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white/10 backdrop-blur-2xl border border-white/20 w-full max-w-2xl p-8 rounded-[40px] shadow-2xl relative">
                        <button 
                            onClick={() => setShowEnquiryModal(false)}
                            className="absolute top-6 right-8 text-white/60 hover:text-white"
                        >
                            <X size={28} />
                        </button>
                        
                        <h2 className="text-3xl font-black text-white mb-8 text-center">Enquiry Form</h2>
                        
                        <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={(e) => e.preventDefault()}>
                            <div className="space-y-2 text-left">
                                <Label className="text-white/80 ml-1">Name</Label>
                                <Input className="bg-white/5 border-white/10 text-white rounded-xl h-11 focus:ring-emerald-500" placeholder="Your Name" />
                            </div>
                            <div className="space-y-2 text-left">
                                <Label className="text-white/80 ml-1">Contact Details</Label>
                                <Input className="bg-white/5 border-white/10 text-white rounded-xl h-11 focus:ring-emerald-500" placeholder="+91 00000 00000" />
                            </div>
                            <div className="space-y-2 text-left">
                                <Label className="text-white/80 ml-1">Email</Label>
                                <Input className="bg-white/5 border-white/10 text-white rounded-xl h-11 focus:ring-emerald-500" placeholder="company@email.com" />
                            </div>
                            <div className="space-y-2 text-left">
                                <Label className="text-white/80 ml-1">Company Name</Label>
                                <Input className="bg-white/5 border-white/10 text-white rounded-xl h-11 focus:ring-emerald-500" placeholder="Shekru Lab India" />
                            </div>
                            <div className="space-y-2 text-left">
                                <Label className="text-white/80 ml-1">Company Address</Label>
                                <Input className="bg-white/5 border-white/10 text-white rounded-xl h-11 focus:ring-emerald-500" placeholder="Enter full address" />
                            </div>
                            <div className="space-y-2 text-left">
                                <Label className="text-white/80 ml-1">Company Type</Label>
                                <select className="w-full bg-white/5 border border-white/10 text-white rounded-xl h-11 px-3 focus:ring-2 focus:ring-emerald-500 outline-none">
                                    <option className="bg-slate-800">IT / Technology</option>
                                    <option className="bg-slate-800">Manufacturing</option>
                                    <option className="bg-slate-800">Education</option>
                                    <option className="bg-slate-800">Other</option>
                                </select>
                            </div>
                            <div className="space-y-2 text-left">
                                <Label className="text-white/80 ml-1">No. of employees</Label>
                                <Input className="bg-white/5 border-white/10 text-white rounded-xl h-11 focus:ring-emerald-500" placeholder="Enter count" type="number" />
                            </div>
                            <div className="space-y-2 text-left">
                                <Label className="text-white/80 ml-1">Promo code</Label>
                                <Input className="bg-white/5 border-white/10 text-white rounded-xl h-11 focus:ring-emerald-500" placeholder="Optional" />
                            </div>
                            
                            <Button className="md:col-span-2 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black h-14 rounded-2xl text-lg mt-4">
                                Submit Enquiry
                            </Button>
                        </form>
                    </div>
                </div>
            )}

            {/* Plans Modal */}
            {showPlansModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in zoom-in duration-300">
                    <div className="bg-white/10 backdrop-blur-2xl border border-white/20 w-full max-w-5xl p-8 rounded-[40px] relative">
                        <button onClick={() => setShowPlansModal(false)} className="absolute top-6 right-8 text-white/60 hover:text-white">
                            <X size={28} />
                        </button>
                        <h2 className="text-4xl font-black text-white mb-10 text-center">Select Your Plan</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {plans.map((p, i) => (
                                <div key={i} className={`p-8 rounded-[32px] border ${p.recommended ? 'bg-emerald-500 border-emerald-400 text-slate-900 scale-105' : 'bg-white/5 border-white/10 text-white'} flex flex-col items-center text-center transition-all`}>
                                    <span className="text-lg font-black uppercase tracking-widest opacity-80 mb-2">{p.name}</span>
                                    <div className="flex items-baseline mb-6">
                                        <span className="text-4xl font-black">{p.price}</span>
                                        <span className="text-xs font-bold ml-1 opacity-60">/{p.period}</span>
                                    </div>
                                    <div className="w-full space-y-4 mb-8 text-left">
                                        {p.features.map((f, j) => (
                                            <div key={j} className="flex items-center gap-2 text-sm font-semibold">
                                                <div className={`rounded-full p-1 ${p.recommended ? 'bg-slate-900 text-emerald-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                    <Check size={12} />
                                                </div>
                                                {f}
                                            </div>
                                        ))}
                                    </div>
                                    <Button className={`w-full h-12 rounded-xl font-bold ${p.recommended ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-emerald-500 text-slate-900 hover:bg-emerald-600'}`}>
                                        Choose Plan
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* About Modal */}
            {showAboutModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in slide-in-from-bottom-10 duration-300">
                    <div className="bg-white/10 backdrop-blur-2xl border border-white/20 w-full max-w-lg p-10 rounded-[40px] relative text-center">
                        <button onClick={() => setShowAboutModal(false)} className="absolute top-6 right-8 text-white/60 hover:text-white">
                            <X size={28} />
                        </button>
                        <h2 className="text-3xl font-black text-white mb-8">About Staffly</h2>
                        <p className="text-slate-200 mb-8 font-medium leading-relaxed">
                            Staffly is a product by Shekru Lab India Pvt. Ltd, dedicated to building advanced HR and workforce management solutions that drive productivity and efficiency.
                        </p>
                        
                        <div className="space-y-6">
                            <div className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-white/5 border border-white/10 group hover:border-emerald-500/50 transition-all">
                                <Mail className="text-emerald-400" size={32} />
                                <span className="text-white font-black text-lg">info@shekruweb.com</span>
                                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Email Support</span>
                            </div>
                            <div className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-white/5 border border-white/10 group hover:border-emerald-500/50 transition-all">
                                <Phone className="text-emerald-400" size={32} />
                                <span className="text-white font-black text-lg">+91 91724 37276</span>
                                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Contact Number</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LandingPage;
