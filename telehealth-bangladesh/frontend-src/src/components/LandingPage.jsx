import React, { useState, useEffect } from 'react';
import landingHero from '../assets/landing_hero.jpg';
import { useLanguage } from './LanguageContext';
import {
  Activity, Shield, Video, FileText, ShoppingBag,
  Menu, X, ArrowRight, Phone, Mail, Lock, UserCheck, CheckCircle2,
  Users, Award, MapPin, Globe, ShieldCheck, Stethoscope, AlertCircle
} from 'lucide-react';
import { Button, VerifiedBadge, SecurityBadge } from './ui';

/* ─── 1. Navbar ─── */
const Navbar = ({ onLogin, onGetStarted }) => {
  const { lang, toggleLanguage } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);

  const scrollTo = (id) => {
    setMobileOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'auto' });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0F172A] border-b border-[#1E293B] text-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          className="flex items-center gap-2.5 cursor-pointer select-none"
          onClick={() => window.scrollTo({ top: 0, behavior: 'auto' })}
        >
          <div className="w-8 h-8 rounded-[10px] bg-[#059669] flex items-center justify-center text-white">
            <Activity className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-base font-extrabold text-[#F8FAFC] tracking-tight">
              Heal<span className="text-[#34D399]">NSight</span>
            </span>
            <span className="hidden sm:inline-block text-[10px] font-medium text-[#94A3B8] ml-2 tracking-wide uppercase">
              Telemedicine Platform
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-[#CBD5E1]">
          <button onClick={() => scrollTo('doctors')} className="hover:text-white cursor-pointer">
            Find a Doctor
          </button>
          <button onClick={() => scrollTo('how-it-works')} className="hover:text-white cursor-pointer">
            How It Works
          </button>
          <button onClick={() => scrollTo('services')} className="hover:text-white cursor-pointer">
            Services
          </button>
          <button onClick={() => scrollTo('security')} className="hover:text-white cursor-pointer">
            Security &amp; Privacy
          </button>
        </nav>

        {/* Desktop Actions & Toggles */}
        <div className="hidden md:flex items-center gap-3">
          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-[#1E293B] bg-[#1E293B] text-[#CBD5E1] hover:bg-[#334155] text-xs font-bold cursor-pointer"
            title="Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-[#34D399]" />
            <span>{lang === 'en' ? 'বাংলা' : 'English'}</span>
          </button>

          {/* Login Button */}
          <button
            onClick={onLogin}
            className="px-4 py-2 rounded-[10px] border border-[#1E293B] bg-[#1E293B] text-[#F8FAFC] hover:bg-[#334155] text-xs font-semibold cursor-pointer"
          >
            Log In
          </button>

          {/* Get Started Button */}
          <Button variant="primary" size="sm" onClick={onGetStarted}>
            Get Started
          </Button>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg text-[#CBD5E1] hover:bg-[#1E293B]"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0F172A] border-b border-[#1E293B] px-5 py-4 space-y-3">
          <button onClick={() => scrollTo('doctors')} className="block w-full text-left py-2 text-xs font-semibold text-[#CBD5E1]">
            Find a Doctor
          </button>
          <button onClick={() => scrollTo('how-it-works')} className="block w-full text-left py-2 text-xs font-semibold text-[#CBD5E1]">
            How It Works
          </button>
          <button onClick={() => scrollTo('services')} className="block w-full text-left py-2 text-xs font-semibold text-[#CBD5E1]">
            Services
          </button>
          <button onClick={() => scrollTo('security')} className="block w-full text-left py-2 text-xs font-semibold text-[#CBD5E1]">
            Security &amp; Privacy
          </button>

          <div className="pt-3 border-t border-[#1E293B] flex flex-col gap-2">
            <button
              onClick={toggleLanguage}
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-[10px] border border-[#1E293B] bg-[#1E293B] text-xs font-semibold text-[#CBD5E1]"
            >
              <Globe className="w-4 h-4 text-[#34D399]" />
              <span>{lang === 'en' ? 'বাংলায় দেখুন' : 'Switch to English'}</span>
            </button>
            <button onClick={onLogin} className="w-full py-2.5 rounded-[10px] border border-[#1E293B] bg-[#1E293B] text-xs font-semibold text-white">
              Log In
            </button>
            <Button variant="primary" onClick={onGetStarted} className="w-full">
              Get Started
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};

/* ─── 2. Hero Section ─── */
const Hero = ({ onFindDoctor, onGetStarted }) => {
  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-20 bg-[#F4F6F9] border-b border-[#BDDDFA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Headline & Action */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E7F0FC] border border-[#BDDDFA] text-[#0F172A] text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-[#059669]" />
              <span>Certified Healthcare Network for Bangladesh</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0F172A] tracking-tight leading-tight">
              Better Healthcare.<br />
              <span className="text-[#059669]">Wherever You Are.</span>
            </h1>

            <p className="text-sm sm:text-base text-[#334155] max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Connect with verified physicians across Bangladesh. Access video consultations, manage encrypted medical records, and receive digital prescriptions—all through a secure telemedicine platform.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
              <Button size="lg" variant="primary" onClick={onFindDoctor} icon={ArrowRight} iconPosition="right" className="w-full sm:w-auto">
                Find a Doctor
              </Button>
              <Button size="lg" variant="outline" onClick={onGetStarted} className="w-full sm:w-auto">
                Get Started
              </Button>
            </div>

            {/* Reassuring Healthcare Badges */}
            <div className="pt-6 border-t border-[#BDDDFA] grid grid-cols-3 gap-4 text-left">
              <div>
                <p className="text-xs font-bold text-[#0F172A]">BMDC Verified</p>
                <p className="text-[11px] text-[#55647C]">Audited medical licenses</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#0F172A]">End-to-End Encrypted</p>
                <p className="text-[11px] text-[#55647C]">Private clinical rooms</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#0F172A]">Nationwide Access</p>
                <p className="text-[11px] text-[#55647C]">Across all 64 districts</p>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Telemedicine Hero Card */}
          <div className="lg:col-span-5">
            <div className="mx-auto max-w-md lg:max-w-none">
              <div className="rounded-2xl overflow-hidden border border-[#BDDDFA] bg-white">
                <img
                  src={landingHero}
                  alt="Doctor reviewing digital health record"
                  className="w-full h-80 sm:h-96 object-cover"
                />
                <div className="p-5 bg-white border-t border-[#BDDDFA] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[10px] bg-[#E7F0FC] border border-[#BDDDFA] flex items-center justify-center text-[#059669]">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#0F172A]">Live Consultation Ready</p>
                      <p className="text-[11px] text-[#55647C]">Specialists available now</p>
                    </div>
                  </div>
                  <VerifiedBadge text="BMDC Active" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ─── 3. Trust & Credibility Strip ─── */
const TrustStrip = () => {
  const items = [
    { title: "BMDC Certified Physicians", desc: "Every doctor's registration number is authenticated.", icon: UserCheck },
    { title: "Client-Side Cryptography", desc: "Health records are protected with device-level AES-256 keys.", icon: Lock },
    { title: "Zero Software Install", desc: "Runs directly in your browser on mobile, tablet, and PC.", icon: Globe },
    { title: "Nationwide Coverage", desc: "Available for patients across rural and urban Bangladesh.", icon: MapPin }
  ];

  return (
    <section className="py-8 bg-white border-b border-[#BDDDFA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-start gap-3.5 p-3 rounded-xl bg-[#E7F0FC]/50 border border-[#BDDDFA]">
                <div className="w-9 h-9 rounded-[10px] bg-white border border-[#BDDDFA] text-[#059669] flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">{item.title}</h4>
                  <p className="text-[11px] text-[#55647C] mt-0.5 leading-normal">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/* ─── 4. How It Works ─── */
const HowItWorks = ({ onGetStarted }) => {
  const steps = [
    {
      num: "01",
      title: "Discover a Verified Specialist",
      desc: "Search by specialty, consultation fee, or symptoms. Review credentials and verified BMDC registration details.",
      icon: Stethoscope
    },
    {
      num: "02",
      title: "Consult via Video or Chat",
      desc: "Join your consultation with a single click. Experience encrypted, low-latency audio/video with cellular voice fallback.",
      icon: Video
    },
    {
      num: "03",
      title: "Get Digital Prescription & Care",
      desc: "Receive your tamper-evident digital prescription instantly. Download PDF records or have medicines dispatched to your home.",
      icon: FileText
    }
  ];

  return (
    <section id="how-it-works" className="py-16 bg-[#F4F6F9] border-b border-[#BDDDFA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] block mb-1">Simplicity &amp; Convenience</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
            How HealNSight Works
          </h2>
          <p className="text-sm text-[#55647C] mt-2">
            Getting professional healthcare advice takes three simple steps—from scheduling to receiving your digital prescription.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="bg-white border border-[#BDDDFA] rounded-2xl p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-[10px] bg-[#059669] text-white flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-2xl font-bold text-[#CBD5E1] font-mono">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#0F172A] mb-1.5">{step.title}</h3>
                  <p className="text-xs text-[#334155] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <Button variant="primary" onClick={onGetStarted} icon={ArrowRight} iconPosition="right">
            Start Your Consultation Today
          </Button>
        </div>
      </div>
    </section>
  );
};

/* ─── 5. Healthcare Services Grid ─── */
const Services = () => {
  const services = [
    {
      title: "Doctor Consultation",
      desc: "Connect with certified general physicians and specialists across medicine, pediatrics, and cardiology.",
      icon: Users
    },
    {
      title: "Video Telemedicine",
      desc: "Consult face-to-face via secure, low-bandwidth WebRTC video directly from your browser.",
      icon: Video
    },
    {
      title: "Health Records",
      desc: "Upload lab tests, imaging, and clinical histories. Control exactly who can view your medical data.",
      icon: FileText
    },
    {
      title: "Verifiable E-Prescriptions",
      desc: "Receive tamper-evident digital prescriptions with doctor signature credentials, ready to print or save.",
      icon: Award
    },
    {
      title: "Doorstep Pharmacy Delivery",
      desc: "Order prescribed medicines conveniently with integrated bKash/Nagad checkout and courier tracking.",
      icon: ShoppingBag
    },
    {
      title: "Secure Medical Communication",
      desc: "Private end-to-end encrypted messaging protected by cryptographic session keys that the server cannot read.",
      icon: Shield
    }
  ];

  return (
    <section id="services" className="py-16 bg-white border-b border-[#BDDDFA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] block mb-1">Comprehensive Telehealth</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
            Healthcare Services
          </h2>
          <p className="text-sm text-[#55647C] mt-2">
            Designed to meet the full spectrum of patient and doctor needs under strict clinical safety standards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((svc, idx) => {
            const Icon = svc.icon;
            return (
              <div
                key={idx}
                className="bg-[#E7F0FC]/40 border border-[#BDDDFA] rounded-2xl p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 rounded-[10px] bg-[#E7F0FC] border border-[#BDDDFA] text-[#059669] flex items-center justify-center mb-3">
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="text-sm font-bold text-[#0F172A] mb-1.5">{svc.title}</h3>
                  <p className="text-xs text-[#334155] leading-relaxed">{svc.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/* ─── 6. Featured Doctors Directory ─── */
const FeaturedDoctors = ({ onGetStarted }) => {
  const doctors = [
    {
      name: "Dr. Sarah Jenkins",
      specialty: "Cardiology",
      bmdc: "A-84920",
      hospital: "Dhaka Heart Institute",
      experience: "12 Years",
      fee: "800 BDT"
    },
    {
      name: "Dr. Zara Rahman",
      specialty: "Pediatrics",
      bmdc: "A-91045",
      hospital: "Shishu Hospital & Institute",
      experience: "9 Years",
      fee: "600 BDT"
    },
    {
      name: "Dr. Kamal Hossain",
      specialty: "General Medicine",
      bmdc: "A-72314",
      hospital: "Bangabandhu Sheikh Mujib Medical Univ.",
      experience: "15 Years",
      fee: "500 BDT"
    }
  ];

  return (
    <section id="doctors" className="py-16 bg-[#F4F6F9] border-b border-[#BDDDFA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] block mb-1">Licensed Physicians</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
              Verified Doctors
            </h2>
            <p className="text-xs text-[#55647C] mt-1">
              Every practitioner is authenticated against Bangladesh Medical &amp; Dental Council records.
            </p>
          </div>
          <Button variant="outline" onClick={onGetStarted} size="sm">
            View All Specialists
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {doctors.map((doc, idx) => (
            <div
              key={idx}
              className="bg-white border border-[#BDDDFA] rounded-2xl p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-[10px] bg-[#E7F0FC] border border-[#BDDDFA] text-[#059669] font-bold flex items-center justify-center text-sm">
                    {doc.name.split(' ')[1]?.[0] || 'D'}
                  </div>
                  <VerifiedBadge text="BMDC Verified" />
                </div>

                <h3 className="text-sm font-bold text-[#0F172A]">{doc.name}</h3>
                <p className="text-xs font-semibold text-[#059669] mt-0.5">{doc.specialty}</p>
                <p className="text-xs text-[#55647C] mt-1">{doc.hospital}</p>

                <div className="mt-4 pt-3 border-t border-[#BDDDFA]/60 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#94A3B8] block text-[10px] uppercase font-semibold">Experience</span>
                    <span className="font-semibold text-[#334155]">{doc.experience}</span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] block text-[10px] uppercase font-semibold">Fee</span>
                    <span className="font-semibold text-[#334155]">{doc.fee}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-[#BDDDFA]/60">
                <Button variant="primary" size="sm" onClick={onGetStarted} className="w-full">
                  Book Appointment
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ─── 7. Security & Privacy Architecture ─── */
const SecuritySection = () => {
  const capabilities = [
    {
      title: "Health Records",
      desc: "Medical reports are hashed and encrypted on device before entering the database. Symmetric keys are governed by the patient.",
      icon: Lock
    },
    {
      title: "Multi-Factor Authentication (MFA)",
      desc: "Protects doctor workstations and patient accounts with 6-digit cryptographic one-time passwords.",
      icon: ShieldCheck
    },
    {
      title: "Consent-Based Access Control",
      desc: "Doctors cannot view patient history without explicit, time-limited digital authorization that patients can revoke anytime.",
      icon: CheckCircle2
    },
    {
      title: "BMDC License Audits",
      desc: "System administrators review and verify national medical registry credentials before doctor routing is enabled.",
      icon: UserCheck
    },
    {
      title: "Private WebRTC Telemedicine",
      desc: "Consultations use direct peer-to-peer media streams with Twilio PSTN voice failover for rural connectivity.",
      icon: Video
    },
    {
      title: "Cryptographic Audit Ledger",
      desc: "Every record access, decryption event, and login session is permanently recorded in the system audit log.",
      icon: Award
    }
  ];

  return (
    <section id="security" className="py-16 bg-[#0F172A] text-[#F8FAFC] border-b border-[#1E293B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold text-[#34D399] uppercase tracking-wider block mb-1">Architectural Integrity</span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F8FAFC]">
            Security &amp; Privacy by Design
          </h2>
          <p className="text-xs sm:text-sm text-[#CBD5E1] mt-2">
            HealNSight is built upon verified cybersecurity standards to safeguard sensitive clinical records and patient privacy.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((cap, idx) => {
            const Icon = cap.icon;
            return (
              <div
                key={idx}
                className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 rounded-[10px] bg-[#0F172A] border border-[#334155] text-[#34D399] flex items-center justify-center mb-3">
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="text-sm font-bold text-[#F8FAFC] mb-1.5">{cap.title}</h3>
                  <p className="text-xs text-[#CBD5E1] leading-relaxed">{cap.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/* ─── 8. Professional Healthcare Footer ─── */
const Footer = ({ onLogin, onGetStarted }) => {
  return (
    <footer className="bg-[#0F172A] text-[#CBD5E1] text-xs border-t border-[#1E293B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Col 1: Brand Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-[8px] bg-[#059669] flex items-center justify-center text-white">
                <Activity className="w-4 h-4" />
              </div>
              <span className="text-sm font-extrabold text-[#F8FAFC] tracking-tight">HealNSight</span>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Secure, end-to-end encrypted telemedicine platform connecting patients and certified physicians across Bangladesh.
            </p>
          </div>

          {/* Col 2: Services */}
          <div>
            <h4 className="text-[#F8FAFC] font-bold mb-3 uppercase tracking-wider text-[10px]">Platform Services</h4>
            <ul className="space-y-1.5 text-xs text-[#CBD5E1]">
              <li><button onClick={onGetStarted} className="hover:text-white cursor-pointer">Video Consultation</button></li>
              <li><button onClick={onGetStarted} className="hover:text-white cursor-pointer">E-Prescriptions</button></li>
              <li><button onClick={onGetStarted} className="hover:text-white cursor-pointer">Health Records</button></li>
              <li><button onClick={onGetStarted} className="hover:text-white cursor-pointer">Medicine Delivery</button></li>
            </ul>
          </div>

          {/* Col 3: Compliance */}
          <div>
            <h4 className="text-[#F8FAFC] font-bold mb-3 uppercase tracking-wider text-[10px]">Compliance &amp; Trust</h4>
            <ul className="space-y-1.5 text-xs text-[#94A3B8]">
              <li>BMDC Registration Verified</li>
              <li>HIPAA &amp; GDPR Architectural Standards</li>
              <li>AES-256 GCM Client Cryptography</li>
              <li>Patient Data Consent Control</li>
            </ul>
          </div>

          {/* Col 4: Emergency */}
          <div>
            <h4 className="text-[#F8FAFC] font-bold mb-3 uppercase tracking-wider text-[10px]">Emergency Contacts</h4>
            <div className="space-y-1.5 text-xs text-[#CBD5E1]">
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#34D399]" />
                <span>Health Helpline: <strong className="text-white">16263</strong></span>
              </p>
              <p className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-[#FF7A7A]" />
                <span>National Emergency: <strong className="text-white">999</strong></span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#FBBF24]" />
                <span>Gov Information: <strong className="text-white">333</strong></span>
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-[#1E293B] flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-[#94A3B8]">
          <p>© {new Date().getFullYear()} HealNSight Healthcare. National Telemedicine Network.</p>
          <div className="flex gap-4">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Security Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

/* ─── 9. Main Export ─── */
export const LandingPage = ({ onLogin, onGetStarted }) => {
  return (
    <div className="min-h-screen bg-[#F4F6F9] text-[#0F172A]">
      <Navbar onLogin={onLogin} onGetStarted={onGetStarted} />
      <main>
        <Hero onFindDoctor={onGetStarted} onGetStarted={onGetStarted} />
        <TrustStrip />
        <HowItWorks onGetStarted={onGetStarted} />
        <Services />
        <FeaturedDoctors onGetStarted={onGetStarted} />
        <SecuritySection />
      </main>
      <Footer onLogin={onLogin} onGetStarted={onGetStarted} />
    </div>
  );
};

export default LandingPage;
