import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface LegalPageShellProps {
  badge: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}

function LegalPageShell({ badge, title, updated, children }: LegalPageShellProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <section className="py-20 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 max-w-3xl relative z-10">
          <div className="inline-block px-4 py-1 mb-8 border border-[hsl(46,98%,52%)] text-[hsl(46,98%,52%)] font-bold text-xs tracking-widest">
            {badge}
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">{title}</h1>
          <p className="text-sm" style={{ color: "hsl(220,25%,62%)" }}>Last updated: {updated}</p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="prose prose-neutral max-w-none text-muted-foreground leading-relaxed space-y-8">
            {children}
          </div>
        </div>
      </section>

      <section className="py-16 bg-card border-t border-border">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-2xl font-bold mb-4">Questions? Get In Touch.</h2>
          <p className="text-muted-foreground mb-8">Our team is happy to answer any questions about how we handle your data or our terms of service.</p>
          <Link href="/contact">
            <Button size="lg" className="rounded-xl h-12 px-8 font-bold">
              Contact Us <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalPageShell badge="LEGAL" title="Privacy Policy" updated="3 June 2026">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">1. Who We Are</h2>
        <p>
          CtrlTrade® is a trading name operated in the United Kingdom. We provide trade business management software including CRM, EPOS, scheduling, invoicing, and related services (the "Platform"). When we refer to "we", "us", or "our" in this policy, we mean CtrlTrade®.
        </p>
        <p className="mt-3">
          We are the data controller for personal data collected through our website and Platform. You can contact us at any time via our <Link href="/contact" className="text-primary hover:underline">contact page</Link>.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">2. What Data We Collect</h2>
        <p>We collect the following categories of personal data:</p>
        <ul className="list-disc pl-6 mt-3 space-y-1.5">
          <li><strong className="text-foreground">Account data:</strong> name, email address, phone number, business name, and billing address when you register.</li>
          <li><strong className="text-foreground">Usage data:</strong> how you interact with the Platform, features used, pages visited, and actions taken.</li>
          <li><strong className="text-foreground">Customer data:</strong> data you enter about your own customers (leads, contacts, job details) as part of using our CRM and EPOS features. You are the data controller for this data; we process it on your behalf.</li>
          <li><strong className="text-foreground">Payment data:</strong> billing information processed securely through Stripe. We do not store full card details.</li>
          <li><strong className="text-foreground">Technical data:</strong> IP address, browser type, device information, and cookies (see Section 7).</li>
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">3. How We Use Your Data</h2>
        <p>We use your personal data to:</p>
        <ul className="list-disc pl-6 mt-3 space-y-1.5">
          <li>Provide, operate, and improve the Platform.</li>
          <li>Process your subscription payments and send invoices.</li>
          <li>Send service communications (account alerts, security notices, product updates).</li>
          <li>Respond to support enquiries.</li>
          <li>Comply with our legal obligations.</li>
          <li>Analyse usage to improve features and performance.</li>
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">4. Legal Basis For Processing</h2>
        <p>We rely on the following legal bases under UK GDPR:</p>
        <ul className="list-disc pl-6 mt-3 space-y-1.5">
          <li><strong className="text-foreground">Contract:</strong> processing necessary to provide the Platform under our Terms of Service.</li>
          <li><strong className="text-foreground">Legitimate interests:</strong> improving the Platform, fraud prevention, and security monitoring.</li>
          <li><strong className="text-foreground">Legal obligation:</strong> complying with applicable laws and regulations.</li>
          <li><strong className="text-foreground">Consent:</strong> for optional marketing communications, which you can withdraw at any time.</li>
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">5. Data Sharing</h2>
        <p>We do not sell your personal data. We may share it with:</p>
        <ul className="list-disc pl-6 mt-3 space-y-1.5">
          <li><strong className="text-foreground">Stripe:</strong> for payment processing.</li>
          <li><strong className="text-foreground">Cloud infrastructure providers:</strong> for hosting the Platform (servers located in the UK/EU).</li>
          <li><strong className="text-foreground">Analytics providers:</strong> for usage analytics, on an anonymised or pseudonymised basis where possible.</li>
          <li><strong className="text-foreground">Legal authorities:</strong> where required by law or to protect our legal rights.</li>
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">6. Your Rights</h2>
        <p>Under UK GDPR, you have the right to:</p>
        <ul className="list-disc pl-6 mt-3 space-y-1.5">
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your data (subject to legal obligations).</li>
          <li>Object to or restrict certain processing.</li>
          <li>Data portability — receive your data in a structured, machine-readable format.</li>
          <li>Withdraw consent where processing is based on consent.</li>
          <li>Lodge a complaint with the Information Commissioner's Office (ICO).</li>
        </ul>
        <p className="mt-3">To exercise any of these rights, please <Link href="/contact" className="text-primary hover:underline">contact us</Link>.</p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">7. Cookies</h2>
        <p>
          We use cookies and similar tracking technologies on our website. See our <Link href="/cookies" className="text-primary hover:underline">Cookie Policy</Link> for full details of what we use and how to control your preferences.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">8. Data Retention</h2>
        <p>
          We retain your account data for as long as your account is active and for a reasonable period thereafter to comply with legal obligations and resolve disputes. Customer data you enter into the Platform can be exported and deleted on request.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">9. Changes To This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of material changes by email or via an in-platform notice. Continued use of the Platform after changes constitutes acceptance of the updated policy.
        </p>
      </div>
    </LegalPageShell>
  );
}

export function TermsPage() {
  return (
    <LegalPageShell badge="LEGAL" title="Terms of Service" updated="3 June 2026">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">1. Acceptance of Terms</h2>
        <p>
          By creating an account or using the CtrlTrade® Platform, you agree to be bound by these Terms of Service. If you are entering into these terms on behalf of a business, you represent that you have the authority to bind that business to these terms.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">2. The Platform</h2>
        <p>
          CtrlTrade® provides a cloud-based trade business management platform including CRM, EPOS, scheduling, invoicing, and related tools (the "Platform"). We reserve the right to modify, suspend, or discontinue features with reasonable notice.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">3. Accounts & Access</h2>
        <ul className="list-disc pl-6 mt-3 space-y-1.5">
          <li>You must provide accurate, current, and complete registration information.</li>
          <li>You are responsible for maintaining the security of your account credentials.</li>
          <li>You must notify us immediately of any unauthorised access to your account.</li>
          <li>Each account may be used only by the business that registered it. Resale or sublicensing is prohibited without our written consent.</li>
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">4. Subscription & Billing</h2>
        <ul className="list-disc pl-6 mt-3 space-y-1.5">
          <li>Subscriptions are billed monthly or annually as selected at sign-up.</li>
          <li>A free 1-month trial is offered on new accounts. No credit card is required during the trial period.</li>
          <li>After the trial, a paid subscription is required to continue using the Platform.</li>
          <li>All payments are processed by Stripe. Prices are displayed exclusive of VAT unless stated otherwise.</li>
          <li>We may change subscription prices with at least 30 days' advance notice.</li>
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">5. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 mt-3 space-y-1.5">
          <li>Use the Platform for any unlawful purpose or in violation of any applicable laws.</li>
          <li>Attempt to gain unauthorised access to any part of the Platform or its infrastructure.</li>
          <li>Use automated tools to scrape, index, or extract data from the Platform without our consent.</li>
          <li>Upload malicious code or content that could harm the Platform or other users.</li>
          <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity.</li>
        </ul>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">6. Your Data</h2>
        <p>
          You retain ownership of all data you input into the Platform ("Customer Data"). We process Customer Data on your behalf as a data processor. You are responsible for ensuring you have the right to input data about third parties (such as your customers). See our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> for details.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">7. Intellectual Property</h2>
        <p>
          CtrlTrade®, CtrlTradePos®, and CtrlAI® are registered trademarks. All Platform software, design, and content is owned by us or licensed to us. You are granted a limited, non-exclusive, non-transferable licence to use the Platform for your internal business purposes during your subscription term.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">8. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, our total liability to you for any claims arising from your use of the Platform shall not exceed the total fees paid by you in the 12 months preceding the claim. We are not liable for indirect, consequential, or loss-of-profit damages.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">9. Termination</h2>
        <p>
          You may cancel your subscription at any time from your account settings. We may suspend or terminate your account for material breach of these terms, with notice where reasonably practicable. On termination, you may export your Customer Data within 30 days before it is deleted.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">10. Governing Law</h2>
        <p>
          These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.
        </p>
      </div>
    </LegalPageShell>
  );
}

export function CookiesPage() {
  return (
    <LegalPageShell badge="LEGAL" title="Cookie Policy" updated="3 June 2026">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">1. What Are Cookies?</h2>
        <p>
          Cookies are small text files placed on your device when you visit a website. They are widely used to make websites work efficiently, remember your preferences, and provide information to website operators.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">2. How We Use Cookies</h2>
        <p>We use cookies for the following purposes:</p>

        <div className="mt-4 space-y-4">
          <div className="border border-border p-4 bg-card">
            <h3 className="font-bold text-foreground mb-1">Essential Cookies</h3>
            <p className="text-sm">Required for the Platform to function. These include session management, authentication tokens, and security cookies. These cannot be disabled.</p>
          </div>
          <div className="border border-border p-4 bg-card">
            <h3 className="font-bold text-foreground mb-1">Functional Cookies</h3>
            <p className="text-sm">Remember your preferences such as language settings, UI state, and saved filters. Disabling these may affect the user experience but will not prevent access to the Platform.</p>
          </div>
          <div className="border border-border p-4 bg-card">
            <h3 className="font-bold text-foreground mb-1">Analytics Cookies</h3>
            <p className="text-sm">Help us understand how visitors interact with our website — pages visited, time spent, and errors encountered. Data is aggregated and anonymised where possible. You can opt out of analytics tracking.</p>
          </div>
          <div className="border border-border p-4 bg-card">
            <h3 className="font-bold text-foreground mb-1">Marketing Cookies</h3>
            <p className="text-sm">Used to track referral sources and measure the effectiveness of our marketing campaigns. Only placed with your consent.</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">3. Third-Party Cookies</h2>
        <p>Some cookies are placed by third-party services we use:</p>
        <ul className="list-disc pl-6 mt-3 space-y-1.5">
          <li><strong className="text-foreground">Stripe:</strong> payment processing security and fraud prevention cookies.</li>
          <li><strong className="text-foreground">Analytics providers:</strong> usage analytics and performance monitoring.</li>
        </ul>
        <p className="mt-3">We do not control the cookies set by third parties. Please refer to their respective privacy policies for more information.</p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">4. Managing Cookies</h2>
        <p>You can control cookies in the following ways:</p>
        <ul className="list-disc pl-6 mt-3 space-y-1.5">
          <li><strong className="text-foreground">Browser settings:</strong> most browsers allow you to block or delete cookies. Refer to your browser's help documentation for instructions.</li>
          <li><strong className="text-foreground">Opt-out tools:</strong> for analytics cookies, you may use browser-based opt-out mechanisms such as the Google Analytics Opt-out Browser Add-on.</li>
        </ul>
        <p className="mt-3">Note that blocking essential cookies will prevent the Platform from functioning correctly.</p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-3">5. Changes To This Policy</h2>
        <p>
          We may update this Cookie Policy from time to time. We will notify you of material changes via an in-platform notice or email. See also our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>.
        </p>
      </div>
    </LegalPageShell>
  );
}
