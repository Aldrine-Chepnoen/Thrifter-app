// This is the entry point for the Thrifter frontend application. It imports necessary libraries and components, including React, ReactDOM, the main App component, and the BrowserRouter for routing. The application is rendered inside a StrictMode wrapper to help identify potential issues in the application during development. The BrowserRouter allows for client-side routing, enabling navigation between different pages without full page reloads. The index.css file is also imported to apply global styles to the application. Overall, this file sets up the foundation for the Thrifter frontend application and renders it to the DOM.
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

// Initialize PostHog
// Replace 'YOUR_PROJECT_API_KEY' with your actual key from PostHog settings
posthog.init('phc_AttmJ7ufE6Y3xgDagqoP9D2GFBP9ksKEqPjbHP3xass3', {
  api_host: 'https://us.i.posthog.com',
  person_profiles: 'identified_only',
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PostHogProvider client={posthog}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PostHogProvider>
  </React.StrictMode>,
)
