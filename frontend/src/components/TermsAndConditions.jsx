import React from 'react';

const Clause = ({ n, children }) => (
  <p className="mb-2"><span className="font-semibold">{n}</span> {children}</p>
);

const TermsAndConditions = () => (
  <div className="max-w-3xl mx-auto p-6 text-gray-800 dark:text-gray-200">
    <h1 className="text-3xl font-serif font-bold mb-1">Thrifter — Terms and Conditions of Use</h1>
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
      Operated by E.R.C Innovations UG Limited · Effective Date: 4 July 2026 · Last Updated: 4 July 2026
    </p>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">1. Introduction and Acceptance</h2>
      <Clause n="1.1">These Terms and Conditions (the "Terms") govern access to and use of the Thrifter marketplace, comprising the Thrifter-UG mobile application, the website available at www.thrifter-ug.com, and all related services, features, content and tools (together, the "Platform").</Clause>
      <Clause n="1.2">The Platform is owned and operated by E.R.C Innovations UG Limited (the "Company", "we", "us" or "our"), a limited liability company incorporated in the Republic of Uganda.</Clause>
      <Clause n="1.3">By creating an account, browsing Listings, placing an Order, listing an Item for sale, creating or voting on a Poll, or otherwise using the Platform, you confirm that you have read, understood and agree to be bound by these Terms and by our Privacy Policy and Data Security Statement (the "Privacy Policy"), which is incorporated into these Terms by reference. If you do not agree to these Terms, you must not use the Platform.</Clause>
      <Clause n="1.4">These Terms constitute a valid electronic agreement made in accordance with the Electronic Transactions Act, 2011 and the Electronic Signatures Act, 2011 of the Republic of Uganda.</Clause>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">2. Company Information</h2>
      <p>Company Name: E.R.C Innovations UG Limited</p>
      <p>Registration Number: 80034161901473</p>
      <p>Registered Office: Kyaliwajjala B, Namugongo Division, Wakiso District, Uganda</p>
      <p>Contact Email: ercinnovations.ug@gmail.com</p>
      <p>Contact Phone: +256 794 185 787</p>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">3. Definitions</h2>
      <p className="mb-2"><strong>"Buyer"</strong> means a User who purchases, or seeks to purchase, an Item through the Platform.</p>
      <p className="mb-2"><strong>"Seller" or "Vendor"</strong> means a User who lists Items for sale on the Platform, whether an individual selling personal wardrobe pieces, a thrift reseller, or a registered clothing brand or other commercial vendor.</p>
      <p className="mb-2"><strong>"User", "you" or "your"</strong> means any person who accesses or uses the Platform, whether as a Buyer, a Seller, or otherwise.</p>
      <p className="mb-2"><strong>"Item"</strong> means any article of clothing, footwear or fashion accessory listed for sale on the Platform.</p>
      <p className="mb-2"><strong>"Listing"</strong> means the product page for an Item created by a Seller on the Platform.</p>
      <p className="mb-2"><strong>"Order"</strong> means a Buyer's purchase of one or more Items through the Platform, which may include Items from multiple Sellers (a "Consolidated Order").</p>
      <p className="mb-2"><strong>"Hub"</strong> means a collection and consolidation point operated or designated by the Company for the receipt, inspection and dispatch of Items.</p>
      <p className="mb-2"><strong>"Poll"</strong> means a post created through the Platform's community polls and rankings feature describing an Item, style or category that Users wish to see stocked on the Platform.</p>
      <p className="mb-2"><strong>"Payment Processor"</strong> means Nylon Pay, or any other licensed payment service provider engaged by the Company from time to time to collect and disburse payments.</p>
      <p><strong>"Business Day"</strong> means Monday to Friday, excluding public holidays in Uganda.</p>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">4. Eligibility and Accounts</h2>
      <Clause n="4.1">You must be at least eighteen (18) years of age and legally capable of entering into a binding contract under the laws of Uganda in order to register an account, buy or sell on the Platform.</Clause>
      <Clause n="4.2">You agree to provide accurate, current and complete information during registration and to keep it up to date. Your email address serves as your primary account identifier, as described in the Privacy Policy.</Clause>
      <Clause n="4.3">You may hold only one account unless we expressly authorise otherwise. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. You must notify us promptly at the contact email above of any unauthorised use of your account.</Clause>
      <Clause n="4.4">We may decline registration, or suspend, restrict or close an account, in accordance with clause 17.</Clause>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">5. Nature of the Platform and Our Role</h2>
      <Clause n="5.1">Thrifter is an online marketplace. Except where the Company is expressly identified as the seller of record for a particular Item, the contract of sale for each Item is formed directly between the Buyer and the relevant Seller. The Company is not a party to that contract of sale.</Clause>
      <Clause n="5.2">The Company provides the following services in support of the marketplace: listing and discovery tools; routing of communications between Buyers and Sellers; payment facilitation through the Payment Processor; order consolidation, inspection and delivery arrangement; and community features, including Polls.</Clause>
      <Clause n="5.3">Limited payment collection agent. Each Seller appoints the Company (acting through the Payment Processor) as the Seller's limited agent solely for the purpose of collecting payments from Buyers. A Buyer's full payment to the Company for an Order discharges the Buyer's payment obligation to the relevant Seller(s) for that Order.</Clause>
      <Clause n="5.4">The Company does not manufacture the Items and, except where expressly stated, does not own them. The Company performs a basic visual condition check of Items at the Hub as described in clause 6.5, but does not provide any warranty in respect of Items beyond the remedies expressly set out in clause 8.</Clause>
      <Clause n="5.5">Items offered on the Platform are predominantly second-hand and pre-owned. Reasonable signs of prior wear that are consistent with the condition stated in the Listing do not constitute defects.</Clause>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">6. Seller Terms</h2>
      <h3 className="font-semibold mt-3 mb-1">6.1 Who may sell</h3>
      <p className="mb-3">Any eligible User may sell on the Platform, including individuals selling pieces from their own wardrobe, thrift resellers, and clothing brands or other commercial vendors. Commercial vendors must additionally provide the business information described in the Privacy Policy and any verification information reasonably required by the Company or the Payment Processor.</p>

      <h3 className="font-semibold mt-3 mb-1">6.2 Listings</h3>
      <p className="mb-3">Each Listing must: (a) use genuine photographs of the specific Item offered; (b) accurately describe the Item, including size and, where relevant, measurements, colour, material and brand (where a brand is claimed); (c) disclose the Item's condition, including all material defects, marks, repairs or flaws; and (d) state the price in Uganda Shillings (UGX). By creating a Listing, the Seller warrants that the Seller owns the Item or otherwise has the full right to sell it.</p>

      <h3 className="font-semibold mt-3 mb-1">6.3 Availability confirmation</h3>
      <p className="mb-3">When an Item is ordered, the Seller must confirm its availability through the Platform within the hour of notification, or within such other window displayed in-app. Items that are not confirmed within the applicable window are automatically cancelled and the Buyer refunded for those Items in accordance with clause 8.4.</p>

      <h3 className="font-semibold mt-3 mb-1">6.4 Hub drop-off and consolidation</h3>
      <p className="mb-3">Confirmed Items must be delivered by the Seller to the designated Hub by the batch deadline notified through the Platform. Where the Company offers an optional pick-up service, additional fees apply as displayed in-app. Items that are not received at the Hub by the deadline are cancelled and the Buyer refunded, and the failure is recorded against the Seller's performance under clause 6.8.</p>

      <h3 className="font-semibold mt-3 mb-1">6.5 Inspection and rejection</h3>
      <p className="mb-3">The Company may carry out a reasonable visual inspection of Items at the Hub. The Company may reject and cancel any Item that materially differs from its Listing, including the wrong item, undisclosed damage, hygiene concerns, or indicators that the Item is counterfeit or otherwise a Prohibited Item. Rejected Items are returned to the Seller and the Buyer is refunded for those Items.</p>

      <h3 className="font-semibold mt-3 mb-1">6.6 Fees and commission</h3>
      <p className="mb-3">Commission is charged on each completed sale and deducted before payout to the Seller, according to the Seller's account tier: (a) Sellers on a free account pay a commission of ten percent (10%) of the Item price and have access to the Platform's standard features; and (b) Sellers subscribed to a Premium account, at the subscription fee displayed in-app, pay a commission of five percent (5%) of the Item price and have access to premium features as described in-app. Any other fees (for example, optional pick-up or promoted listings) will be displayed in-app before they are incurred. The Company may offer promotional fee reductions from time to time. Fees may be changed prospectively in accordance with clause 18.</p>

      <h3 className="font-semibold mt-3 mb-1">6.7 Payouts</h3>
      <p className="mb-3">Amounts due to a Seller are settled and reflected on the Seller's Thrifter account and can be withdrawn by the Seller upon request after confirmed delivery of the relevant Item to the Buyer, less applicable commission, fees, and any amounts the Company is required by law to withhold. The Company may delay or withhold a payout where an issue has been reported under clause 8 in respect of the relevant Item, pending resolution.</p>

      <h3 className="font-semibold mt-3 mb-1">6.8 Seller performance</h3>
      <p className="mb-3">The Company monitors Seller performance, including availability confirmation rates, Hub drop-off punctuality, inspection rejection rates and Buyer issue reports. Repeated failures, material misdescription of Items, or fraudulent conduct may result in removal of Listings, demotion in rankings or search, loss of promotional benefits, suspension, or termination of the Seller's account.</p>

      <h3 className="font-semibold mt-3 mb-1">6.9 Taxes</h3>
      <p className="mb-3">Sellers are solely responsible for their own tax obligations arising from their sales on the Platform. Where required by law, the Company may collect, withhold or remit amounts on a Seller's behalf and issue related documentation.</p>

      <h3 className="font-semibold mt-3 mb-1">6.10 Prohibited Items</h3>
      <p className="mb-2">The following may not be listed or sold on the Platform:</p>
      <ul className="list-disc pl-6 space-y-1">
        <li>counterfeit goods or items that infringe any trademark, copyright or other third-party right;</li>
        <li>stolen property or items the Seller does not have the right to sell;</li>
        <li>used undergarments, and used swimwear unless new with tags;</li>
        <li>items that are unsafe, subject to a recall, or unlawful to sell or possess under the laws of Uganda;</li>
        <li>weapons or hazardous materials of any kind; and</li>
        <li>goods outside the fashion categories enabled on the Platform, unless the Company has expressly permitted the category in-app.</li>
      </ul>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">7. Buyer Terms, Orders and Payment</h2>
      <h3 className="font-semibold mt-3 mb-1">7.1 Orders</h3>
      <p className="mb-3">A Buyer's cart may contain Items from multiple Sellers. A Listing constitutes an invitation to treat. An Order becomes binding between the Buyer and each relevant Seller when the Company issues an order confirmation following successful payment authorisation.</p>

      <h3 className="font-semibold mt-3 mb-1">7.2 Pricing and delivery fee</h3>
      <p className="mb-3">
        All prices are displayed in Uganda Shillings (UGX), or in United States Dollars (USD) where expressly indicated.
        The delivery fee for an Order is calculated based on the Buyer's delivery distance from the Company's
        collection point, as a base fee plus a per-kilometre rate, both displayed at checkout, and applies regardless of
        the number of Sellers in a Consolidated Order. Delivery is only available within a maximum service radius
        displayed at checkout; Orders to locations beyond that radius cannot be placed. Where a price is manifestly
        erroneous, the Company may cancel the affected Item(s) and refund the Buyer.
      </p>

      <h3 className="font-semibold mt-3 mb-1">7.3 Payment</h3>
      <p className="mb-3">Orders must be paid for in full, in advance, through the Payment Processor using the methods displayed at checkout (including mobile money). Cash on delivery is not accepted for Consolidated Orders. As described in the Privacy Policy, payment processing is handled by the Payment Processor and the Company does not store raw card numbers or mobile money PINs.</p>

      <h3 className="font-semibold mt-3 mb-1">7.4 Delivery and consolidation</h3>
      <p className="mb-3">Orders are fulfilled in delivery batches. Sellers deliver Items to the Hub, where the Company consolidates each Buyer's Items into a single delivery, dispatched to the delivery address provided by the Buyer within the delivery window displayed at checkout for the Buyer's zone. Delivery windows are estimates given in good faith and are not guaranteed times.</p>

      <h3 className="font-semibold mt-3 mb-1">7.5 Partial fulfilment</h3>
      <p className="mb-3">If any Item in a Consolidated Order is cancelled (including for failure of availability confirmation, failure to reach the Hub, or rejection on inspection), the Company will deliver the remaining Items on schedule and refund the Buyer for the cancelled Item(s). The delivery fee will not be increased as a result of such cancellation.</p>

      <h3 className="font-semibold mt-3 mb-1">7.6 Failed delivery</h3>
      <p className="mb-3">If delivery fails because the address provided is inaccurate or the Buyer is unavailable after reasonable attempts and contact, the Company will contact the Buyer to arrange redelivery or collection, and an additional redelivery fee may apply as displayed in-app.</p>

      <h3 className="font-semibold mt-3 mb-1">7.7 Risk and title</h3>
      <p>Risk in an Item passes to the Buyer upon delivery to the address provided (including acceptance by any person present at that address). Title in an Item passes on the later of payment in full and delivery.</p>
    </section>

    <section className="mb-6" id="refunds">
      <h2 className="text-xl font-serif font-bold mb-2">8. Returns, Refunds and Issues</h2>
      <Clause n="8.1">Items on the Platform are pre-owned unless stated otherwise. Returns for change of mind or fit are not offered, unless the relevant Listing expressly states otherwise.</Clause>
      <Clause n="8.2">A Buyer may report an issue with a delivered Item through the Platform within forty-eight (48) hours of delivery, supported by photographs, where: (a) the Item is materially not as described in the Listing; (b) the wrong Item was delivered; (c) the Item has significant damage that was not disclosed in the Listing; or (d) an Item in the Order was missing.</Clause>
      <Clause n="8.3">The Company will assess reported issues, including against its Hub inspection records, and may at its discretion offer a refund to the original payment method, a replacement where available, or Platform credit. Approved refunds are processed within seven (7) Business Days of approval; the Payment Processor's own timelines may add processing time.</Clause>
      <Clause n="8.4">Refunds for Items cancelled before dispatch (including under clauses 6.3, 6.4, 6.5 and 7.5) are issued automatically without the Buyer needing to raise a report.</Clause>
      <Clause n="8.5">Fraudulent, abusive or repeated unfounded claims may result in account action under clause 17.</Clause>
      <Clause n="8.6">Nothing in these Terms excludes or limits any consumer rights under the laws of Uganda that cannot lawfully be excluded or limited.</Clause>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">9. Polls and Community Rankings</h2>
      <Clause n="9.1">The Platform includes a feature that allows Users to create Polls describing Items or styles they wish to see stocked (for example, "baggy jeans, under UGX 40,000, size M"), and to upvote or downvote Polls created by others. Net votes determine a Poll's position in the rankings and charts visible to Users and Vendors.</Clause>
      <Clause n="9.2">No obligation to stock. Polls and rankings are demand signals only. Neither the Company nor any Seller guarantees that any polled Item or style will be stocked, made available at any particular price, or made available at all.</Clause>
      <Clause n="9.3">Voting integrity. Users may vote only as the feature permits. The creation or use of multiple or fake accounts, bots, scripts, purchased votes, or any other means of manipulating Polls, votes or rankings is prohibited. The Company may remove votes or Polls, and recalculate, adjust or reset rankings, in order to preserve the integrity of the feature.</Clause>
      <Clause n="9.4">Poll content. Polls must not contain unlawful, offensive, misleading or infringing content, the personal data of any other person, or advertising unrelated to the feature. The Company may edit Poll titles for clarity, merge substantially duplicate Polls, remove Polls, and feature Polls and rankings in Platform marketing in accordance with the licence in clause 10.</Clause>
      <Clause n="9.5">Rankings, charts, vote counts and related statistics are provided on an "as is" basis.</Clause>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">10. User Content and Licence</h2>
      <Clause n="10.1">Users retain ownership of the content they submit to the Platform, including Listings, photographs, descriptions, Polls, comments and reviews ("User Content").</Clause>
      <Clause n="10.2">By submitting User Content, you grant the Company a non-exclusive, worldwide, royalty-free, sublicensable licence to host, store, reproduce, adapt (for formatting and display), publish, display and distribute that User Content for the purposes of operating, improving and promoting the Platform, including in the Company's social media and marketing materials. This licence continues after content is removed to the extent the content has already been incorporated into marketing materials or is retained in transaction records as required by law.</Clause>
      <Clause n="10.3">You warrant that your User Content is owned by you or duly licensed to you, is accurate, and does not infringe the rights of any third party or violate any law.</Clause>
      <Clause n="10.4">The Company may moderate, remove or refuse any User Content at its discretion. Reports of infringing or unlawful content should be sent to the contact email in clause 2.</Clause>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">11. Acceptable Use</h2>
      <p className="mb-2">You must not, in connection with the Platform:</p>
      <ul className="list-disc pl-6 space-y-1">
        <li>use the Platform other than for lawful purposes and in accordance with the laws of the Republic of Uganda;</li>
        <li>interfere with, disrupt or damage the Platform, its networks or security, or attempt to gain unauthorised access to any systems or data;</li>
        <li>scrape, harvest or use automated means to access or collect data from the Platform without the Company's prior written consent;</li>
        <li>engage in false, misleading or deceptive conduct, including shill bidding, fake reviews or misrepresentation of Items;</li>
        <li>use the Platform to identify a counterparty and then complete or attempt to complete the transaction off-Platform in order to avoid fees, or solicit other Users to do so;</li>
        <li>conduct transaction-related communications outside the channels provided by the Platform where in-Platform channels are available;</li>
        <li>harass, abuse, threaten or defame any other User or any member of the Company's staff or delivery partners; or</li>
        <li>reverse engineer, decompile or disassemble any part of the Platform except to the extent permitted by applicable law.</li>
      </ul>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">12. Intellectual Property</h2>
      <Clause n="12.1">The Thrifter name and logo, and all software, source code, design, databases, rankings, and other content and intellectual property comprised in the Platform (excluding User Content), are and remain the exclusive property of the Company or its licensors. Users are granted a limited, revocable, non-exclusive and non-transferable licence to use the Platform for its intended purposes in accordance with these Terms.</Clause>
      <Clause n="12.2">You may not reproduce, distribute, or create derivative works from any part of the Platform or the Company's intellectual property without the prior written consent of the Company.</Clause>
      <Clause n="12.3">Third-party brand names and trademarks appearing in Listings belong to their respective owners. The listing of a branded Item does not imply any affiliation with, or endorsement by, the brand owner.</Clause>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">13. Privacy and Data Protection</h2>
      <Clause n="13.1">The Company collects and processes personal data in accordance with the Privacy Policy and the Data Protection and Privacy Act, 2019 of Uganda. This includes payment processing through the Payment Processor, analytics through PostHog, and hosting and infrastructure services as described in the Privacy Policy.</Clause>
      <Clause n="13.2">In accordance with the Electronic Transactions Act, 2011, transactional invoices, financial records, account histories and vendor registry logs are retained for a minimum period of seven (7) years, as further described in the Privacy Policy.</Clause>
      <Clause n="13.3">Requests relating to personal data, including access, correction and deletion requests, should be directed to the contact email in clause 2. Account deletion is also available in-app.</Clause>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">14. Disclaimers</h2>
      <Clause n="14.1">The Platform is provided on an "as is" and "as available" basis. To the maximum extent permitted by law, the Company does not warrant that the Platform will be uninterrupted, error-free or free of harmful components.</Clause>
      <Clause n="14.2">Items are supplied by Sellers. Except for the inspection and remedies expressly described in clauses 6.5 and 8, the Company gives no warranty, condition or representation in respect of any Item, including as to quality, fitness for purpose, authenticity or description.</Clause>
      <Clause n="14.3">Delivery windows, rankings, charts and similar figures are estimates or informational features only and do not constitute guarantees.</Clause>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">15. Limitation of Liability</h2>
      <Clause n="15.1">To the maximum extent permitted by the laws of Uganda, the Company, its directors, officers, employees and agents shall not be liable for any indirect, incidental, special or consequential loss or damage, or for any loss of profits, revenue, data, goodwill or business opportunity, arising out of or in connection with the Platform or these Terms.</Clause>
      <Clause n="15.2">To the maximum extent permitted by law, the aggregate liability of the Company arising out of or in connection with any Order shall not exceed the total amount paid by the Buyer for that Order (including the delivery fee), and in respect of any other claim shall not exceed UGX 500,000.</Clause>
      <Clause n="15.3">Nothing in these Terms excludes or limits liability for fraud, for death or personal injury caused by negligence, or for any other liability that cannot be excluded or limited under the laws of Uganda.</Clause>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">16. Indemnity</h2>
      <p>You agree to indemnify and hold harmless the Company, its directors, officers, employees and agents from and against all claims, liabilities, damages, losses and expenses (including reasonable legal fees) arising out of or in connection with: (a) your breach of these Terms; (b) your User Content; (c) Items you list or sell; or (d) your misuse of the Platform or violation of any law or third-party right.</p>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">17. Suspension and Termination</h2>
      <Clause n="17.1">You may close your account at any time using the in-app account deletion function or by written request to the contact email in clause 2.</Clause>
      <Clause n="17.2">The Company may suspend, restrict or terminate an account, remove Listings or other content, or withhold features, where it reasonably believes there has been a breach of these Terms, fraud or other unlawful activity, a risk to other Users or to the Company, or where required by law. Where practicable, the Company will give notice, but may act without notice where the circumstances reasonably require.</Clause>
      <Clause n="17.3">On closure or termination of an account: outstanding paid Orders will be completed or refunded; amounts legitimately owed to a Seller will be paid out in accordance with clause 6.7, subject to set-off for any amounts owed to the Company or withheld pending unresolved issue reports.</Clause>
      <Clause n="17.4">Clauses which by their nature should survive termination (including clauses 10, 12, 15, 16, 20 and 21) shall survive.</Clause>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">18. Changes to the Terms and the Services</h2>
      <Clause n="18.1">The Company may modify the Platform, its features and its fees at its discretion. The Company may amend these Terms from time to time; material changes will be notified in-app or by email, together with the effective date of the change. Continued use of the Platform after the effective date constitutes acceptance of the amended Terms. If you do not agree to an amendment, you must stop using the Platform.</Clause>
      <Clause n="18.2">The Company may modify, suspend or discontinue any part of the Platform. Orders already paid for at the time of any suspension or discontinuation will be completed or refunded.</Clause>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">19. Force Majeure</h2>
      <p>The Company shall not be liable for any delay or failure to perform its obligations to the extent caused by events beyond its reasonable control, including network or power outages, acts of government, civil unrest, epidemics, floods or other natural events, strikes, or failures of third-party infrastructure. Delivery windows shall be extended by a period corresponding to the delay caused by such events.</p>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">20. General</h2>
      <Clause n="20.1">Entire agreement. These Terms, together with the Privacy Policy and any policies displayed in-app that are expressly incorporated, constitute the entire agreement between you and the Company in relation to the Platform.</Clause>
      <Clause n="20.2">Severability. If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.</Clause>
      <Clause n="20.3">No waiver. A failure or delay by the Company to enforce any provision of these Terms shall not constitute a waiver of that provision or of any other provision.</Clause>
      <Clause n="20.4">Assignment. The Company may assign or transfer its rights and obligations under these Terms to an affiliate or a successor in business. You may not assign your rights or obligations under these Terms without the Company's prior written consent.</Clause>
      <Clause n="20.5">Notices. The Company may give notices in-app or to the email address registered to your account, and such notices are deemed received in accordance with the Electronic Transactions Act, 2011. Notices to the Company should be sent to the contact email in clause 2.</Clause>
      <Clause n="20.6">Relationship. Nothing in these Terms creates any partnership, joint venture, employment or agency relationship between you and the Company, except for the limited payment collection agency described in clause 5.3.</Clause>
      <Clause n="20.7">App stores. Where the application is downloaded from a third-party app store, that store is not a party to these Terms and has no obligation or liability in respect of the Platform.</Clause>
    </section>

    <section className="mb-6">
      <h2 className="text-xl font-serif font-bold mb-2">21. Governing Law and Dispute Resolution</h2>
      <Clause n="21.1">These Terms are governed by and construed in accordance with the laws of the Republic of Uganda.</Clause>
      <Clause n="21.2">Before commencing any formal proceedings, the parties shall first attempt in good faith to resolve any dispute arising out of or in connection with these Terms through the Company's support channels, allowing a period of thirty (30) days for negotiation from the date the dispute is first notified.</Clause>
      <Clause n="21.3">Subject to clause 21.2, any dispute arising from these Terms shall be subject to the exclusive jurisdiction of the courts of the Republic of Uganda.</Clause>
      <Clause n="21.4">Disputes between a Buyer and a Seller are between those parties. The Company may facilitate resolution as described in clause 8 but is not obliged to adjudicate beyond the remedies expressly set out in these Terms.</Clause>
    </section>

    <section>
      <h2 className="text-xl font-serif font-bold mb-2">22. Contact</h2>
      <p>Questions about these Terms may be directed to:</p>
      <p>Email: ercinnovations.ug@gmail.com</p>
      <p>Phone: +256 794 185 787</p>
      <p>Post: E.R.C Innovations UG Limited, Kyaliwajjala B, Namugongo Division, Wakiso District, Uganda</p>
    </section>
  </div>
);

export default TermsAndConditions;
