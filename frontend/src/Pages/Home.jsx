import React from 'react'
import Hero from '../components/Hero'
import LatestOffers from '../components/LatestOffers'
import BudgetSmartphoneDeals from '../components/BudgetSmartPhones'
import DialPhoneDeals from '../components/DialPhones'
import NewIphones from '../components/NewIphones'

const Home = () => {
  return (
    <div>
        <Hero/>
        <LatestOffers/>
        <BudgetSmartphoneDeals/>
        <DialPhoneDeals/>
        <NewIphones/>



    </div>
  )
}

export default Home