import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";

// Apollo Client
import { ApolloProvider } from "@apollo/client/react"; // ✅ fixed import
import client from "./apolloClient.js"; // <-- import your Apollo client

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Wrap the whole app with ApolloProvider */}
    <ApolloProvider client={client}>
      <App />
      <ToastContainer position="top-right" autoClose={3000} newestOnTop />
    </ApolloProvider>
  </React.StrictMode>
);
