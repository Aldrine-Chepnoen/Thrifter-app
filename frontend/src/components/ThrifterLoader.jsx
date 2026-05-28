import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { dotWave, leapfrog, waveform, hatch } from 'ldrs';

dotWave.register();
leapfrog.register();
waveform.register();
hatch.register();

const LOADERS = [
  {
    key: 'dot-wave',
    el: <l-dot-wave size="47" speed="1" color="#EAAD11" />,
    duration: 2000,
  },
  {
    key: 'leapfrog',
    el: <l-leapfrog size="40" speed="2.5" color="#EAAD11" />,
    duration: 5000,
  },
  {
    key: 'waveform',
    el: <l-waveform size="35" stroke="3.5" speed="1" color="#EAAD11" />,
    duration: 2000,
  },
  {
    key: 'hatch',
    el: <l-hatch size="28" stroke="4" speed="3.5" color="#EAAD11" />,
    duration: 7000,
  },
];

const ThrifterLoader = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIndex((prev) => (prev + 1) % LOADERS.length);
    }, LOADERS[index].duration);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <div className="flex items-center justify-center w-full py-16">
      <AnimatePresence mode="wait">
        <motion.div
          key={LOADERS[index].key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {LOADERS[index].el}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default ThrifterLoader;
