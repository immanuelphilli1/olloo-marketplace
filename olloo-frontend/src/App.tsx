import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { getAccountPath } from './data/accountRoutes'
import { AuthProvider } from './context/AuthContext'
import { CatalogProvider } from './context/CatalogContext'
import { ShopProvider } from './context/ShopContext'
import { ScrollToTop } from './components/ScrollToTop'
import { RequireAuth } from './components/RequireAuth'
import { AboutPage } from './pages/AboutPage'
import { AccountPage } from './pages/AccountPage'
import { GoogleOAuthCallbackPage } from './pages/GoogleOAuthCallbackPage'
import { HomePage } from './pages/HomePage'
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage'
import { ReturnRefundPolicyPage } from './pages/ReturnRefundPolicyPage'
import { IntellectualPropertyPage } from './pages/IntellectualPropertyPage'
import { SecurePaymentsPage } from './pages/SecurePaymentsPage'
import { ShippingDeliveryPolicyPage } from './pages/ShippingDeliveryPolicyPage'
import { TermsOfUsePage } from './pages/TermsOfUsePage'
import { WarrantyPolicyPage } from './pages/WarrantyPolicyPage'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/products/:productId" element={<HomePage />} />
      <Route path="/categories" element={<HomePage />} />
      <Route path="/categories/:categoryId" element={<HomePage />} />
      <Route path="/cart" element={<HomePage />} />
      <Route path="/checkout" element={<HomePage />} />
      <Route path="/checkout/return" element={<HomePage />} />
      <Route path="/checkout/cancel" element={<HomePage />} />
      <Route path="/order-complete" element={<HomePage />} />
      <Route path="/wishlist" element={<HomePage />} />
      <Route path="/search" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/warranty" element={<WarrantyPolicyPage />} />
      <Route path="/shipping-delivery" element={<ShippingDeliveryPolicyPage />} />
      <Route path="/return-refund" element={<ReturnRefundPolicyPage />} />
      <Route path="/secure-payments" element={<SecurePaymentsPage />} />
      <Route path="/intellectual-property" element={<IntellectualPropertyPage />} />
      <Route path="/terms-of-use" element={<TermsOfUsePage />} />
      {/* Must stay in step with the redirect_uri registered with Google. */}
      <Route path="/oauth/google/callback" element={<GoogleOAuthCallbackPage />} />
      <Route
        path="/account/:section"
        element={
          <RequireAuth>
            <AccountPage />
          </RequireAuth>
        }
      />
      <Route path="/account" element={<Navigate to={getAccountPath('orders')} replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CatalogProvider>
        <ShopProvider>
          <ScrollToTop />
          <AppRoutes />
        </ShopProvider>
        </CatalogProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
