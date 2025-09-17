import React from 'react'
import { FaHeadset, FaShippingFast, FaThumbsUp, FaFacebook, FaInstagram, FaTwitter, FaWhatsapp } from 'react-icons/fa'
import logo from '../assets/logo.svg'

const Footer = () => {
  return (
    <footer className='mt-10'>

      {/* Top Strip */}
      <div className='bg-blue-500 text-white py-6'>
        <div className='container mx-auto flex flex-col md:flex-row justify-between items-center gap-6 px-4'>
          {/* Customer Support */}
          <div className='flex items-center gap-3'>
            <FaHeadset size={30} />
            <div>
              <h4 className='font-bold'>Customer Support</h4>
              <p className='text-sm'>We’re here to help anytime</p>
            </div>
          </div>

          {/* Shipping */}
          <div className='flex items-center gap-3'>
            <FaShippingFast size={30} />
            <div>
              <h4 className='font-bold'>Quick Delivery</h4>
              <p className='text-sm'>Fast shipping across Kenya</p>
            </div>
          </div>

          {/* Authentic */}
          <div className='flex items-center gap-3'>
            <FaThumbsUp size={30} />
            <div>
              <h4 className='font-bold'>Trusted Quality</h4>
              <p className='text-sm'>100% genuine electronics</p>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section */}
      <div className='bg-white py-10'>
        <div className='container mx-auto grid md:grid-cols-4 gap-8 px-4'>
          {/* Logo */}
          <div>
            <img src={logo} alt="PhonesStore Logo" className='w-32 mb-4' />
          </div>

          {/* Find Us */}
          <div>
            <h4 className='text-blue-600 font-semibold mb-3'>Find Us</h4>
            <p><span className='font-bold'>Location:</span> Kawangware BP, Opposite Shell Petrol Station, Nairobi, Kenya</p>
            <p><span className='font-bold'>Phone:</span> 0795299451</p>
            <p><span className='font-bold'>Email:</span> jontechtechnology@gmail.com</p>
          </div>

          {/* Company Links */}
          <div>
            <h4 className='text-blue-600 font-semibold mb-3'>Our Company</h4>
            <ul className='space-y-2'>
              <li><a href='#' className='hover:underline'>Privacy Policy</a></li>
              <li><a href='#' className='hover:underline'>Refunds & Return Policy</a></li>
              <li><a href='#' className='hover:underline'>Terms and Conditions</a></li>
              <li><a href='#' className='hover:underline'>Shipping and Return Policy</a></li>
            </ul>
          </div>

          {/* Social Icons */}
          <div>
            <h4 className='font-semibold mb-3 text-blue-600'>Follow Us</h4>
            <div className='flex gap-4 text-xl'>
              <a 
                href="https://wa.me/254795299451?text=Hello%20I%20am%20interested%20in%20your%20products" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <FaWhatsapp />
              </a>
              <a href='#'><FaFacebook /></a>
              <a href='#'><FaInstagram /></a>
              <a href='#'><FaTwitter /></a>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className='bg-blue-500 text-white text-center text-sm py-4'>
        &copy; Jontech Technology. All Rights Reserved. <span>BrunexItech</span>
      </div>

    </footer>
  )
}

export default Footer
