import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";

import Home from "./Pages/Home";
import LaptopPage from "./Pages/LaptopPage";
import StoragePage from "./Pages/StoragePage";
import MkopaPage from "./Pages/MkopaPage";
import SmartPhonesPage from "./Pages/SmartPhonesPage";
import TabletsPage from "./Pages/TabletsPage";
import Audio from "./components/Audio";
import MobileAccessoriesPage from "./Pages/MobileAccessoriesPage";
import TelevisionPage from "./Pages/TelevisionPage";
import LoginForm from "./components/LoginForm";
import RegistrationForm from "./components/RegistrationForm";
import ProductDetail from "./components/ProductDetail";
import Cart from "./components/Cart";
import TabletDetail from "./components/TabletDetail";
import SmartphoneDetail from "./components/SmartphoneDetails";
import StorageDetail from "./components/StorageDetail";
import AudioDetail from "./components/AudioDetail";
import MobileAccessoryDetail from "./components/MobileAccessoryDetail";
import TelevisionDetail from "./components/TelevisionDetail";
import MkopaDetail from "./components/MkopaDetail";
import Reallaptops from "./components/Reallaptops";
import ReallaptopDetail from "./components/ReallaptopDetail";
import LatestOffers from "./components/LatestOffers";
import LatestOfferDetail from "./components/LatestOfferDetail";
import BudgetSmartphoneDetail from "./components/BudgetSmartphoneDetail";
import DialPhoneDetail from "./components/DialPhoneDetail";
import NewIphoneDetail from "./components/NewIphoneDetail";
import Checkout from "./components/Checkout";
import OrderConfirmation from "./components/OrderConfirmation";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import SearchResults from "./components/SearchResults";
import ScrollToTop from "./components/ScrollToTop";

const App = () => {
  return (
    <Router>
      <ScrollToTop />
      <Header />

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/laptops" element={<LaptopPage />} />
          <Route path="/storage/:id" element={<StorageDetail />} />
          <Route path="/storage" element={<StoragePage />} />
          <Route path="/mkopa" element={<MkopaPage />} />
          <Route path="/mkopa/:id" element={<MkopaDetail />} />
          <Route path="/smartphones" element={<SmartPhonesPage />} />
          <Route path="/smartphone/:id" element={<SmartphoneDetail />} />
          <Route path="/tablets" element={<TabletsPage />} />
          <Route path="/tablet/:id" element={<TabletDetail />} />
          <Route path="/budget-smartphones/:id" element={<BudgetSmartphoneDetail />} />
          <Route path="/register" element={<RegistrationForm />} />
          <Route path="/login" element={<LoginForm />} />
          <Route path="/audio" element={<Audio />} />
          <Route path="/audio/:id" element={<AudioDetail />} />
          <Route path="/mobile-accessories" element={<MobileAccessoriesPage />} />
          <Route path="/accessories/:id" element={<MobileAccessoryDetail />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/reallaptops" element={<Reallaptops />} />
          <Route path="/reallaptop/:id" element={<ReallaptopDetail />} />
          <Route path="/dialphones/:id" element={<DialPhoneDetail />} />
          <Route path="/new-iphones/:id" element={<NewIphoneDetail />} />
          <Route path="/televisions" element={<TelevisionPage />} />
          <Route path="/televisions/:id" element={<TelevisionDetail />} />
          <Route path="/latest-offers" element={<LatestOffers />} />
          <Route path="/latest-offers/:id" element={<LatestOfferDetail />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-confirmation/:id" element={<OrderConfirmation />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/search" element={<SearchResults />} />
        </Routes>
      </main>

      <Footer />
    </Router>
  );
};

export default App;
