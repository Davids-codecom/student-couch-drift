import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const TERMS_CONTENT = `
Terms and Conditions for Couch-Share.com

Last updated: February 2026

Please read these terms and conditions carefully before using Couch-Share.com ("the Service"). By accessing or using the Service you agree to be bound by these Terms. If you disagree with any part of the Terms then you may not access the Service.

1. Overview
Couch-Share.com is an online platform that connects hosts and renters for temporary housing. Couch-Share.com acts solely as a neutral marketplace. Hosts and renters are independent parties and are solely responsible for the agreements they enter into and the experiences they provide or receive.

2. Eligibility
You must be at least 18 years old and legally able to enter into binding contracts to use Couch-Share.com. By registering you represent and warrant that the information you provide is accurate and truthful.

3. User Accounts
You must provide accurate, complete, and current information when creating your account. Your login credentials are personal and non-transferable. You are responsible for safeguarding your account and for any actions taken under your account. Couch-Share.com is not responsible for any loss or damage arising from unauthorized use of your credentials.

4. Listings and Reservations
Hosts are solely responsible for the accuracy of their listings, including availability, pricing, and applicable house rules. Renters are responsible for reviewing the listing details before submitting booking requests. By submitting a booking request the renter confirms they understand the price, dates, and house rules. Couch-Share.com does not guarantee that listings are accurate, safe, or suitable for any purpose.

5. Payments
All payments are processed by Stripe or another third-party payment provider. Couch-Share.com does not hold funds on behalf of users. Stripe processes the payment using the host's account and payouts are governed by Stripe's policies. Couch-Share.com is not responsible for payment failures or disputes. Refunds, cancellations, and disputes must be resolved directly between hosts and renters.

6. Identity Verification
Couch-Share.com requires student accounts to register with a valid educational email address (for example, an .edu address) and complete email verification. Owner accounts may be approved through a separate owner-only process. Couch-Share.com makes no guarantees concerning the identity of users, and you are responsible for conducting your own due diligence and exercising caution when interacting with other users.

7. Conduct
Users agree not to:
• Violate any laws, rules, or regulations.
• Provide false or misleading information.
• Use the Service for any harmful or unlawful purpose.
• Discriminate against or harass other users.
• Damage property or engage in unsafe behavior during stays.

Couch-Share.com may suspend or terminate accounts that violate these Terms at its sole discretion.

8. Limitation of Liability
Couch-Share.com, including its owners, employees, and affiliates, is not liable for any direct, indirect, incidental, consequential, special, exemplary, or punitive damages arising from or relating to your use of the Service, including but not limited to personal injury, property damage, disputes between users, or legal claims. Couch-Share.com provides the platform "as is" without warranties of any kind.

9. Indemnification
You agree to indemnify and hold Couch-Share.com harmless from any claims, losses, liabilities, damages, costs, or expenses (including legal fees) arising from your use of the Service, your breach of these Terms, or your violation of any law or rights of a third party.

10. Dispute Resolution
Couch-Share.com is not a party to disputes between users. Hosts and renters must resolve disputes directly. Couch-Share.com may, at its sole discretion, facilitate communication between parties but has no obligation to mediate or resolve disputes.

11. Termination
We may terminate or suspend your account at any time, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination your right to use the Service will immediately cease.

12. Changes to Terms
We may modify these Terms at any time by posting an updated version on Couch-Share.com. Your continued use of the Service constitutes acceptance of the revised Terms.

13. Governing Law
These Terms are governed by the laws applicable to Couch-Share.com. Any legal action or proceeding arising under these Terms will be brought exclusively in the courts located in the jurisdiction of Couch-Share.com.

14. Contact Us
If you have any questions about these Terms, please contact Couch-Share.com using our support channels.`;

const TermsDialog = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" className="text-xs font-semibold underline" onClick={() => setOpen(true)}>
        View terms and conditions
      </button>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Terms &amp; Conditions</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] rounded-md border p-4">
          <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {TERMS_CONTENT}
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default TermsDialog;
