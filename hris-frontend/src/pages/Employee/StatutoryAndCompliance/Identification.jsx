import CustomLabel from "../../../components/CustomLabel";

function Identification() {
    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between border-b border-slate-100 pb-4">
                <CustomLabel
                    variant='h2' 
                    children='Identifications' 
                    addedClass='font-bold text-slate-700!' 
                    descriptionClass='text-sm text-slate-500'
                    description="Manage employee identification records."
                />
            </div>
        </div>
    );
}
export default Identification;