import React from 'react';

const PrivacyPolicy = () => (
  <div className="max-w-3xl mx-auto p-6 text-gray-800 dark:text-gray-200">
    <h1 className="text-3xl font-serif font-bold mb-1">Privacy Policy and Data Security Statement for Thrifter-UG</h1>
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last Updated: June 2026</p>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">1. Introduction and Legal Framework</h2>
      <p>
        This Privacy Policy describes how E.R.C INNOVATIONS UG LIMITED ("we", "us", or "our") collects, protects, uses, and
        shares personal data from users and commercial vendors of the Thrifter-ug mobile application marketplace. This
        document is compiled to satisfy the strict requirements of Uganda's Data Protection and Privacy Act, 2019, and
        the Electronic Transactions Act, 2011.
      </p>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">2. The Data We Collect</h2>
      <p className="mb-2">To provide marketplace and e-commerce services, we collect the following types of information:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li><strong>Customer Identity &amp; Account Data:</strong> Email Address (used as the primary account authentication identifier), Phone Number, and Delivery/Physical Address.</li>
        <li><strong>Customer Preference Data:</strong> Wardrobe data and shopping profile metadata (including saved fashion items, favorites, and curated lists per user account).</li>
        <li><strong>Vendor / Merchant Commerce Data:</strong> Commercial store name, physical shop or warehouse coordinates/location, business biography, and commercial phone number.</li>
        <li><strong>Technical &amp; Usage Analytics Data:</strong> Internet Protocol (IP) address, device operating system details, and app interaction tracking markers via PostHog event logs (website only).</li>
      </ul>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">3. Analytics Tracking and Behavioral Events</h2>
      <p className="mb-2">
        To optimize our marketplace interface, our website collects automated usage events via PostHog integration. By
        interacting with the platform, you consent to the logging of behavioral actions, which include:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Product item views and detailed wardrobe/favorites additions.</li>
        <li>Visual image search queries processed by the application interface.</li>
      </ul>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">4. Purpose of Processing and Data Retention</h2>
      <p>
        We process your personal data strictly to fulfill e-commerce product orders, verify marketplace vendors, route
        customer communication to sellers, manage digital wardrobe profiles, and process local taxes. In accordance
        with Section 17 of Uganda's Electronic Transactions Act, all transactional invoices, financial metadata, user
        account histories, and vendor registry logs are securely retained for a mandatory minimum period of seven (7)
        years.
      </p>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">5. Third-Party Disclosures and Global Data Transfers</h2>
      <p className="mb-2">
        To power our platform infrastructure, information is shared securely with trusted digital dependencies. You
        consent to data being processed by:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li><strong>Nylon Pay:</strong> For secure local mobile money and card transaction routing.</li>
        <li><strong>Supabase, Inc. &amp; Vercel, Inc.:</strong> For core cloud database hosting, primary email account authentication, and edge interface computing (hosted globally in the United States and European Union).</li>
        <li><strong>Cloudinary, Ltd.:</strong> For secure cloud asset hosting of item listings, user profile imagery, and vendor product photos.</li>
        <li><strong>PostHog, Inc.:</strong> For platform event logging, visual search analytics, and interactive usage tracking (website only).</li>
      </ul>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">6. Data Security Measures</h2>
      <p className="mb-2">
        We enforce robust physical, technical, and administrative protections to safeguard all collected personal data
        from unauthorized access, breach, or alteration:
      </p>
      <ul className="list-disc pl-6 space-y-2">
        <li><strong>Encryption in Transit:</strong> All traffic utilizes strict Transport Layer Security (TLS) cryptographic HTTPS protocols.</li>
        <li><strong>Encryption at Rest:</strong> Databases deployed across cloud architecture nodes use Advanced Encryption Standard (AES-256) encryption.</li>
        <li><strong>Access Control:</strong> Administrative system dashboard controls require strict access authentication.</li>
        <li><strong>Financial Isolation:</strong> Payment processing is sandboxed entirely via Nylon Pay. Raw mobile money PINs or credit card numbers are tokenized and never pass through or enter our system storage pools.</li>
        <li><strong>System Failure Redundancy:</strong> Continuous automated cryptographic cloud database backups are maintained daily.</li>
      </ul>
    </section>

    <section className="mb-6" id="account-deletion">
      <h2 className="text-xl font-serif font-bold mb-2">7. Account Deletion</h2>
      <p className="mb-2">You can permanently delete your Thrifter account and its associated personal data at any time:</p>
      <ul className="list-disc pl-6 space-y-2 mb-2">
        <li><strong>In the mobile app:</strong> sign in, go to Profile, and select "Delete Account".</li>
        <li><strong>On the website:</strong> sign in at thrifter-ug.com, go to Account, and select "Delete my account".</li>
      </ul>
      <p className="mb-2">
        Both paths require you to be signed in and take effect immediately. Upon deletion, your email address, password,
        and Google sign-in link are permanently removed or anonymized, and your account can no longer be used to sign in.
      </p>
      <p className="mb-2">
        As described in Section 4 above, transactional invoices, financial records, and order history tied to your
        account are retained for a minimum of seven (7) years as required by Section 17 of Uganda's Electronic
        Transactions Act, 2011, even after your account is deleted. This retained data is kept solely for legal and
        accounting compliance and is no longer linked to a usable login.
      </p>
      <p>
        Vendor accounts with a non-zero wallet balance, an unresolved withdrawal, or an order still in progress must
        resolve these first — the app will indicate what needs to be settled before deletion can proceed.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-serif font-bold mb-2">8. Contact</h2>
      <p>
        Questions about this Privacy Policy may be directed to ercinnovations.ug@gmail.com or +256 794 185 787.
      </p>
    </section>
  </div>
);

export default PrivacyPolicy;
