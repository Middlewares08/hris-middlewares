'use client'
import { memo } from 'react';
import { Form, Formik } from 'formik';
import PropTypes from 'prop-types';

CustomForm.propTypes = {
    /** Any: Form content */
    content: PropTypes.any.isRequired,

    /** Any: Initial form values */
    initialValues: PropTypes.any.isRequired,

    /** Function: Submit action of form */
    onSubmit: PropTypes.func.isRequired,

    /** Any: Validation for schema */
    validationSchema: PropTypes.any.isRequired,

    /** Object: A form reference object */
    formRef: PropTypes.object, 

    /** String: An id of a form. */
    id: PropTypes.string
};

function CustomForm(props) {

    const handleKeyPress = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
        }
    };
    return (
        <Formik
            innerRef={(formikInstance) => {
                if (props && props.formRef) {
                    props.formRef.current = formikInstance; // Standard assignment works perfectly
                }
            }}
            enableReinitialize
            initialValues={props?.initialValues}
            validationSchema={props?.validationSchema}
            onSubmit={props?.onSubmit}
            key={props?.key}
        > 
            {({ errors, touched, handleReset, handleSubmit, values, setFieldValue, setFieldTouched, getFieldProps }) => (
                <Form id={props?.id} key={props?.key} onReset={handleReset} onSubmit={handleSubmit} encType='multipart/form-data' className='flex flex-col gap-3' onKeyDown={handleKeyPress}>
                   {
                        props?.content(errors, touched, handleSubmit, values, setFieldValue, setFieldTouched, getFieldProps)
                   }
                </Form>
            )}
        </Formik>
    );
}

export default memo(CustomForm);