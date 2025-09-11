import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";

const types = [
  { name: "QBO To QBO", image: "../../public/QBOQBO.png" },
  { name: "Sage One To QBO", image: "../../public/SAGEQBO.png" },
  { name: "Reckon Desktop To Xero", image: "../../public/RECKONXERO.png" },
  { name: "Xero To Xero", image: "../../public/XEROXERO.png" },
  // { name: "Wave To QBO", image: "../../public/WAVEQBO.png" },
  // { name: "Wave To Xero", image: "../../public/WAVEXERO.png "},
];

export default function SoftwareTypeModal({ isOpen, onSelect, onClose }) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gradient-to-r from-[#0b1a3b] to-[#112240]" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className="w-full max-w-4xl transform overflow-hidden gradient-bg rounded-xl border border-gray-700 p-6 text-white align-middle shadow-xl transition-all"
              >
                <Dialog.Title className="text-2xl font-bold mb-4 text-center">
                  Please Select Softwares For Conversion...
                </Dialog.Title>

                <div className="max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-blue-400 scrollbar-track-gray-700 rounded-md">
                  <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 gap-6">
                    {types.map((type) => (
                      <div
                        key={type.name}
                        onClick={() => onSelect(type.name)}
                        className="cursor-pointer bg-black rounded-xl overflow-hidden shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
                      >
                        <img
                          src={type.image}
                          alt={type.name}
                          className="h-40 w-full object-cover"
                        />
                        <div className="bg-gradient-to-r from-[#0b1a3b] to-[#112240] text-center font-semibold text-white">
                          {type.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
