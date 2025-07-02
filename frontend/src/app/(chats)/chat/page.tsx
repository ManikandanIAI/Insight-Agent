import React, { Suspense } from 'react'
import SpecificChat from './component/SpecificChat'

const TestPage = () => {
  return (

    <Suspense fallback={<div className='h-screen w-full flex gap-x-1 items-center justify-center'>
      <p className='text-xl text-primary-main'>Loading...</p>
    </div>}>
      <SpecificChat />
    </Suspense>

  )
}

export default TestPage
