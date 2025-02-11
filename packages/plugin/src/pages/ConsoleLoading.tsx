import React from 'react'
import './console-loading.css'

type LoadingProps = {
  className?: string;
}

export const ConsoleLoading: React.FunctionComponent<LoadingProps> = ({ className }) => (

  <React.Fragment>
    <p className='hawtio-console-loading-text'>HawtIO Loading ...</p>

    <div
      className='hawtio-console-loading-icon co-m-loader co-an-fade-in-out'
      data-test="loading-indicator"
    >
      <div className="co-m-loader-dot__one"></div>
      <div className="co-m-loader-dot__two"></div>
      <div className="co-m-loader-dot__three"></div>
    </div>

  </React.Fragment>
)
