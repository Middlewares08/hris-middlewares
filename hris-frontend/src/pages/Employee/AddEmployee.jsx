import CustomInput from "../../components/CustomInput";
import { BLANK, EMPLOYMENT_TYPES, GENDER, NATIONALITIES, RELATIONSHIP_OPTIONS, RELIGIONS } from "../../utils/constants";
import { CustomFileUploader } from "../../components/CustomFileUploader";
import { useState } from "react";
import CustomLabel from "../../components/CustomLabel";
import CustomDropdown from "../../components/CustomDropdown";
import CustomDatePicker from "../../components/CustomDatePicker";
import { address } from 'addresspinas';
import * as addresspinas from 'addresspinas';
import { usePositions } from "../../hooks/usePosition";
import { useMemo } from "react";
import { formatGovernmentId } from "../../utils/utils";

export const BasicInformation = ({ payload, onChange, errors, touched }) => {

    // Local state to manage the file upload preview cleanly outside CustomForm
    const [fileValue, setFileValue] = useState(payload?.uploaded_profile);
    const regions = addresspinas?.philData?.allRegions?.regions || [];
   
    // addresspinas wrappers return { name, provinces: [...] } or { name, cityOrMunicipal: [...] }
    const provinceData = payload?.region ? address.getProvinceOfRegion(payload?.region) : null;
    const provinces = provinceData?.provinces || [];

    const cityData = payload?.province ? address.getCityMunOfProvince(payload?.province) : null;
    const cities = cityData?.cityAndMun || [];

    const barangayData = payload?.city ? address.getBarangaysOfCityMun(payload?.city) : null;
    const barangays = barangayData?.barangays || [];

    return (
        <div className="scrollbar-y-visible overflow-y-auto max-h-[50vh] border-t border-t-slate-200 py-4 px-2">
            <div className="space-y-4 text-left flex w-full space-x-5 ">
                <div className="w-1/3 mb-0 border-r-slate-100 border-r pr-3 mr-2">
                    <div className="h-full p-2 flex flex-col justify-center">
                        <CustomFileUploader
                            value={fileValue} 
                            onChange={(fileData) => {
                                setFileValue(fileData);
                                onChange({ uploaded_profile: fileData });
                            }} 
                            accept="image/*"
                            description={<><span>Upload Employee Photo</span><br/><span>Image up to 5mb</span></>}
                        />
                    </div>
                </div>
                <div className="gap-4 w-2/3 space-y-4 my-3 ml-2">
                    <CustomInput
                        label="Last Name"
                        labelPosition="left"
                        type="text"
                        maxLength={50}
                        isRequired={true}
                        placeholder="Enter last name.."
                        value={payload?.lastname} 
                        onChange={(e) => onChange({ lastname: e.target.value })}
                        error={errors.lastname && touched.lastname}
                        errorLabel={errors.lastname}
                    />

                    <CustomInput
                        label="First Name"
                        labelPosition="left"
                        type="text"
                        maxLength={50}
                        isRequired={true}
                        placeholder="Enter first name.."
                        value={payload?.firstname}
                        onChange={(e) => onChange({ firstname: e.target.value })}
                        error={errors.firstname && touched.firstname}
                        errorLabel={errors.firstname}
                    />

                    <CustomInput
                        label="Email address"
                        labelPosition="left"
                        type="text"
                        isRequired={true}
                        maxLength={50}
                        placeholder="john_doe@email.com"
                        value={payload?.email}
                        onChange={(e) => onChange({ email: e.target.value })}
                        error={errors.email && touched.email}
                        errorLabel={errors.email}
                    />
                </div>
            </div>
            <div className="border-t border-t-slate-200 space-y-5">
                <CustomLabel
                    variant='h3' 
                    children='Employee Information' 
                    addedClass='font-bold text-slate-500! mt-3' 
                />

                <div className="flex space-x-4 px-3">
                    <CustomDropdown
                        className="items-start! w-full "
                        label="Nationality"
                        options={NATIONALITIES}
                        value={payload?.nationality}
                        onChange={(val) => onChange({ nationality: val })}
                        renderProps="name"
                        returnProps="code"
                        placeholder="Select nationality"
                    />
                    <CustomDropdown
                        className="items-start! w-full "
                        label="Religious Affiliation"
                        options={RELIGIONS}
                        value={payload?.religion}
                        onChange={(val) =>  onChange({ religion: val })}
                        renderProps="name"
                        returnProps="code"
                        placeholder="Select religion"
                    />
                    
                </div>

                <div className="flex space-x-4 px-3">
                    <CustomDatePicker
                        className="text-left!"
                        label="Birthdate"
                        maxDate={new Date()}
                        value={payload?.birth_date}
                        onChange={(date) => onChange({ birth_date: date })}
                        error={errors.birth_date && touched.birth_date}
                        errorLabel={errors.birth_date}
                    />
                    <CustomDropdown
                        className="items-start! w-full "
                        label="Gender"
                        options={GENDER}
                        value={payload?.gender}
                        onChange={(selectedValue) => {onChange({ gender: selectedValue })}}
                        renderProps="label"
                        returnProps="value"
                        disabled={false}
                        error={errors.gender && touched.gender}
                        errorLabel={errors.gender}
                        placeholder="Choose gender.."
                    />
                </div>

                <CustomLabel
                    variant='h3' 
                    children='Address' 
                    addedClass='font-bold text-slate-500! mt-3' 
                />
                <div className="space-x-4 px-3 space-y-5">
                    <div className="flex space-x-4">
                        <CustomDropdown
                            className="items-start! w-full "
                            label="Region"
                            options={regions}
                            value={payload?.region}
                            renderProps="name"
                            returnProps="reg_code"
                            onChange={(val) =>  { onChange({ region: val, province: BLANK, city: BLANK, barangay: BLANK, postal: BLANK })}} // setFormData({ region: val, province: '', city: '' })} // Clear child chains
                            placeholder="Select Region"
                        />

                        {/* 🇵🇭 Province Selection */}
                        <CustomDropdown
                            label="Province"
                            className="items-start! w-full "
                            options={provinces}
                            value={payload?.province}
                            renderProps="name"
                            returnProps="prov_code"
                            disabled={!payload?.region}
                            onChange={(val) =>  { onChange({ province: val, city: BLANK, barangay: BLANK, postal: BLANK })}} 
                            placeholder={payload?.region ? "Select Province" : "Choose a Region first"}
                        />
                    </div>

                    <div className="flex space-x-4">
                        <CustomDropdown
                            className="items-start! w-full"
                            label="City/Municipality"
                            options={cities}
                            value={payload?.city}
                            renderProps="name"
                            returnProps="mun_code"
                            onChange={(val) => {
                                const selectedCity = cities.find((c) => c.mun_code === val);

                                const zipResult = address.getZipcode({
                                    name: selectedCity?.name,
                                    mun_code: val, // this is your city's "code" from returnProps
                                });

                                onChange({
                                    city: val,
                                    barangay: BLANK,
                                    postal: Array.isArray(zipResult) && zipResult.length === 1
                                        ? zipResult[0]   // only one zip -> auto-fill directly
                                        : '',            // multiple zips -> leave blank, resolve at barangay step
                                });
                            }}
                            placeholder="Select City/Municipality"
                        />
                        
                        <CustomDropdown
                            className="items-start! w-full"
                            label="Barangay"
                            options={barangays}
                            value={payload?.barangay}
                            renderProps="name"
                            returnProps="name"
                            onChange={(val) => {
                                const selectedBarangay = barangays.find((b) => b.name === val);

                                const zipResult = address.getZipcode({
                                    name: selectedBarangay?.name,
                                    mun_code: payload?.city,
                                });

                                onChange({
                                    barangay: val,
                                    postal: Array.isArray(zipResult) ? zipResult[0] : zipResult ?? '',
                                });
                            }}
                            placeholder="Select Barangay"
                            disabled={!payload?.city} // barangay list depends on city being picked first
                        />

                        <CustomInput
                            label="Postal / ZIP Code"
                            labelPosition="left"
                            type="text"
                            disabled={true}
                            placeholder="E.g. 3000"
                            value={payload?.postal}
                        />
                    </div>
                </div>
                
            </div>
        </div>
    );
};

export const Employement = ({ payload, onChange, errors, touched }) => {
    const { positionList } = usePositions();
    const selectedPosition = useMemo(() => {
        if (!payload?.position || !positionList) return null;
        return positionList.find(prev => prev?.id === payload?.position) || null;
    }, [payload?.position, positionList]);

    return (
        <>
        
            <div className="scrollbar-y-visible overflow-y-auto max-h-[50vh] border-t border-t-slate-200 py-4">
                <CustomLabel
                    variant='h3' 
                    children='Employent Details' 
                    addedClass='font-bold text-slate-500! mb-5 text-center' 
                />
                <div className="px-2">
                    <div className="space-y-4 text-left flex w-full space-x-5">
                        <CustomDropdown
                            isRequired
                            className="items-start! w-full "
                            label="Employment Status/Type"
                            options={EMPLOYMENT_TYPES}
                            value={payload?.employment_type}
                            onChange={(val) =>  onChange({ employment_type: val })}
                            renderProps="label"
                            returnProps="value"
                            placeholder="Select employment status/type"
                            error={errors.employment_type && touched.employment_type}
                            errorLabel={errors.employment_type}
                        />
                        <CustomDatePicker
                            className="text-left!"
                            label="Date Hired"
                            isRequired
                            value={payload?.date_hired}
                            onChange={(date) => onChange({ date_hired: date })}
                            error={errors.date_hired && touched.date_hired}
                            errorLabel={errors.date_hired}
                        />
                    </div>
                    <div className="space-y-5">
                        <CustomDropdown
                            isRequired
                            className="items-start! w-full "
                            label="Position"
                            options={positionList}
                            value={payload?.position}
                            onChange={(val) => onChange({ position: val })}
                            renderProps="name"
                            returnProps="id"
                            placeholder="Select position.."
                            error={errors.position && touched.position}
                            errorLabel={errors.position}
                        />

                        { selectedPosition && 
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Job Profile</h5>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-sm text-slate-600">Deparment:</span>
                                    <span className="inline-flex items-center font-mono text-xs font-bold tracking-wider px-2.5 py-1 rounded bg-slate-800 text-slate-100 uppercase">
                                        {selectedPosition?.department?.name}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-sm text-slate-600">Base Salary Rate:</span>
                                    <span className="font-mono font-bold text-slate-900 text-base">
                                    ₱{selectedPosition?.rate ? Number(selectedPosition?.rate).toFixed(2) : '0.00'} / {selectedPosition?.position?.rate_type === 'hr' ? 'hr' : 'day'}
                                    </span>
                                </div>
                            </div>
                        }
                    </div>
                </div>
            </div>
        </>
    )
}



export const Benefits = ({ payload, onChange, errors, touched }) => {

    return (
        <div className="scrollbar-y-visible overflow-y-auto max-h-[50vh] border-t border-t-slate-200 py-4 px-2">
            <CustomLabel
                variant='h3' 
                children='Employee Benifits' 
                addedClass='font-bold text-slate-500! mb-5 text-center' 
            />
            <div className="space-y-4 text-left w-full space-x-5 px-3">
                <div className="flex w-full mr-0 gap-3">
                    <div className="w-9/12">
                        <CustomInput
                            label="SSS Number(Social Security System)"
                            labelPosition="left"
                            type="text"
                            maxLength={12}
                            placeholder="00-0000000-0"
                            disabled={payload?.is_sss_exempt}
                            value={payload?.sss}
                            onChange={(e) => onChange({ sss: formatGovernmentId(e.target.value, 'sss') })}
                            error={errors.sss && touched.sss}
                            errorLabel={errors.sss}
                            showCharacterCount
                            showCharacterMaxLength={false}
                            eliminateSpecialCharacterInCount={true}
                            maxLengthShowing={10}
                        />
                    </div>
                   <div className="flex w-3/12">
                        <label className="inline-flex items-center gap-3 cursor-pointer select-none py-1.5 px-3 rounded-md hover:bg-gray-50 transition-colors w-full">
                            <input 
                                type="checkbox" 
                                name="government_ids" 
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded-lg accent-blue-600 cursor-pointer"
                                checked={!!payload?.is_sss_exempt} 
                                onChange={(e) => onChange({ is_sss_exempt: e.target.checked })} 
                            />
                            <span className="text-sm font-medium text-gray-700"> Is SSS exempt</span>
                        </label>  
                    </div>    
                </div>
                
                <div className="flex w-full mr-0 gap-3">
                    <div className="w-9/12">
                        <CustomInput
                            label="Philhealth Number(PIN)"
                            labelPosition="left"
                            type="text"
                            maxLength={14} 
                            placeholder="00-000000000-0"
                            disabled={payload?.is_philhealth_exempt}
                            value={payload?.philhealth}
                            // Format the text in real-time as the user types
                            onChange={(e) => onChange({ philhealth: formatGovernmentId(e.target.value, 'philhealth') })}
                            error={errors.philhealth && touched.philhealth}
                            errorLabel={errors.philhealth}
                            showCharacterCount
                            showCharacterMaxLength={false}
                            eliminateSpecialCharacterInCount={true}
                            maxLengthShowing={12}
                        />
                    </div>
                   <div className="flex w-3/12 ">
                        <label className="inline-flex items-center gap-3 cursor-pointer select-none py-1.5 px-3 rounded-md hover:bg-gray-50 transition-colors w-full">
                            <input 
                                type="checkbox" 
                                name="government_ids" 
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded-lg accent-blue-600 cursor-pointer"
                                checked={!!payload?.is_philhealth_exempt} 
                                onChange={(e) => onChange({ is_philhealth_exempt: e.target.checked })} 
                            />
                            <span className="text-sm font-medium text-gray-700"> Is Philhealth exempt</span>
                        </label>  
                    </div>    
                </div>

                <div className="flex w-full mr-0 gap-3">
                    <div className="w-9/12">
                        <CustomInput
                            label="Pag-IBIG Number(MID)"
                            labelPosition="left"
                            type="text"
                            maxLength={14}
                            placeholder="0000-0000-0000"
                            disabled={payload?.is_pagibig_exempt}
                            value={payload?.pagibig}
                            onChange={(e) => onChange({ pagibig: formatGovernmentId(e.target.value, 'pagibig') })}
                            error={errors.pagibig && touched.pagibig}
                            errorLabel={errors.pagibig}
                            showCharacterCount
                            showCharacterMaxLength={false}
                            eliminateSpecialCharacterInCount={true}
                            maxLengthShowing={12}
                        />
                    </div>
                   <div className="flex w-3/12 ">
                        <label className="inline-flex items-center gap-3 cursor-pointer select-none py-1.5 px-3 rounded-md hover:bg-gray-50 transition-colors w-full">
                            <input 
                                type="checkbox" 
                                name="government_ids" 
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded-lg accent-blue-600 cursor-pointer"
                                checked={!!payload?.is_pagibig_exempt} 
                                onChange={(e) => onChange({ is_pagibig_exempt: e.target.checked })} 
                            />
                            <span className="text-sm font-medium text-gray-700"> Is Pag-IBIG exempt</span>
                        </label>  
                    </div>    
                 </div>

                 <div className="flex w-full mr-0 gap-3">
                    <div className="w-9/12">
                        <CustomInput
                            label="TIN (Taxpayer Identification Number)"
                            labelPosition="left"
                            type="text"
                            maxLength={15}
                            placeholder="000-000-000-000"
                            value={payload?.tin}
                            onChange={(e) => onChange({ tin: formatGovernmentId(e.target.value, 'tin') })}
                            error={errors.tin && touched.tin}
                            errorLabel={errors.tin}
                            showCharacterCount
                            showCharacterMaxLength={false}
                            eliminateSpecialCharacterInCount={true}
                            maxLengthShowing={12}
                        />
                    </div>  
                    <div className="flex w-3/12"></div> 
                 </div>
            </div>
        </div>
    )
}

export const ContactInformation = ({ payload, onChange, errors, touched }) => {
    return (
        <div className="scrollbar-y-visible overflow-y-auto max-h-[50vh] border-t border-t-slate-200 py-4 px-2">
            <CustomLabel
                variant='h3' 
                children='Employee Contact Information' 
                addedClass='font-bold text-slate-500! mb-3 text-center' 
            />
            <div className="space-y-4 text-left w-full space-x-5 px-3 mb-5">
                <CustomInput
                    className='mb-0'
                    label="Employee Mobile Phone Number"
                    labelPosition="left"
                    type="text"
                    maxLength={13}
                    placeholder="0917-123-4567"
                    value={payload?.phone_number}
                    onChange={(e) => onChange({ phone_number: formatGovernmentId(e.target.value, 'phone') })}
                    error={errors.phone_number && touched.phone_number}
                    errorLabel={errors.phone_number}
                    showCharacterCount
                    showCharacterMaxLength={false}
                    eliminateSpecialCharacterInCount={true}
                    maxLengthShowing={11}
                />
                <CustomInput
                    label="Employee Personal Email address"
                    labelPosition="left"
                    type="text"
                    maxLength={50}
                    placeholder="john_doe@email.com"
                    value={payload?.personal_email}
                    onChange={(e) => onChange({ personal_email: e.target.value })}
                    error={errors.personal_email && touched.personal_email}
                    errorLabel={errors.personal_email}
                />
            </div>

            <CustomLabel
                variant='h5' 
                children='Emergency Contact Person' 
                addedClass='font-bold text-slate-500! mb-3 text-center' 
            />

            <div className="space-y-4 text-left w-full space-x-5 px-3">
                <CustomInput
                    label="Emergency Contact Name"
                    labelPosition="left"
                    type="text"
                    maxLength={50}
                    placeholder="Ex. John Doe"
                    value={payload?.emergency_contact_name}
                    onChange={(e) => onChange({ emergency_contact_name: e.target.value })}
                    error={errors.emergency_contact_name && touched.emergency_contact_name}
                    errorLabel={errors.emergency_contact_name}
                />
                <CustomInput
                    className='mb-0'
                    label="Emergency Phone Number"
                    labelPosition="left"
                    type="text"
                    maxLength={13}
                    placeholder="0917-123-4567"
                    value={payload?.emergency_contact_phone}
                    onChange={(e) => onChange({ emergency_contact_phone: formatGovernmentId(e.target.value, 'phone') })}
                    error={errors.emergency_contact_phone && touched.emergency_contact_phone}
                    errorLabel={errors.emergency_contact_phone}
                    showCharacterCount
                    showCharacterMaxLength={false}
                    eliminateSpecialCharacterInCount={true}
                    maxLengthShowing={11}
                />

                <CustomDropdown
                    className="items-start! w-full "
                    label="Relationship to Employee"
                    options={RELATIONSHIP_OPTIONS}
                    value={payload?.emergency_contact_relationship}
                    onChange={(selectedValue) => {onChange({ emergency_contact_relationship: selectedValue })}}
                    renderProps="label"
                    returnProps="value"
                    disabled={false}
                    error={errors.emergency_contact_relationship && touched.emergency_contact_relationship}
                    errorLabel={errors.emergency_contact_relationship}
                    placeholder="Choose relationship.."
                />
            </div>
                
        </div>
    );
};